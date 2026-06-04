import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { isStaffRole } from "@/lib/roles";

export const runtime = "nodejs";

type ParsedRow = {
  rowNumber: number;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  stock: number;
  isActive: boolean;
};

type RowIssue = {
  row: number;
  slug?: string;
  reason: string;
};

const MAX_ROWS = 1000;

function normalizeHeader(value: string) {
  return value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .replace(/_/g, "");
}

function toMap(row: Record<string, unknown>) {
  const map = new Map<string, unknown>();
  for (const [k, v] of Object.entries(row)) {
    map.set(normalizeHeader(k), v);
  }
  return map;
}

function getField(row: Map<string, unknown>, aliases: string[]) {
  for (const alias of aliases) {
    const value = row.get(normalizeHeader(alias));
    if (value !== undefined) return value;
  }
  return undefined;
}

function toCleanString(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function parsePrice(value: unknown) {
  const rawInput = toCleanString(value).replace(/\s+/g, "");
  const hasDot = rawInput.includes(".");
  const hasComma = rawInput.includes(",");
  const raw =
    hasDot && hasComma
      ? rawInput.replace(/\./g, "").replace(/,/g, ".")
      : hasComma
      ? rawInput.replace(/,/g, ".")
      : rawInput;
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

function parseStock(value: unknown) {
  const raw = toCleanString(value).replace(/,/g, ".");
  const n = Number(raw);
  if (!Number.isFinite(n)) return NaN;
  return Math.floor(n);
}

function parseIsActive(value: unknown) {
  const raw = toCleanString(value).toLowerCase();
  if (!raw) return true;
  if (["1", "true", "si", "sí", "yes", "activo", "act", "on"].includes(raw)) {
    return true;
  }
  if (["0", "false", "no", "inactivo", "off"].includes(raw)) {
    return false;
  }
  return null;
}

export async function POST(req: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Archivo requerido (campo file)." }, { status: 400 });
  }

  const filename = file.name.toLowerCase();
  if (!filename.endsWith(".xlsx") && !filename.endsWith(".xls")) {
    return NextResponse.json({ ok: false, error: "Formato inválido. Usá .xlsx o .xls." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer" });
  } catch {
    return NextResponse.json({ ok: false, error: "No se pudo leer el archivo Excel." }, { status: 400 });
  }

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return NextResponse.json({ ok: false, error: "El archivo no tiene hojas." }, { status: 400 });
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  if (rows.length === 0) {
    return NextResponse.json({ ok: false, error: "El archivo no tiene filas de datos." }, { status: 400 });
  }

  if (rows.length > MAX_ROWS) {
    return NextResponse.json(
      { ok: false, error: `Máximo ${MAX_ROWS} filas por importación.` },
      { status: 400 }
    );
  }

  const errors: RowIssue[] = [];
  const skipped: RowIssue[] = [];
  const parsed: ParsedRow[] = [];
  const seenSlugs = new Set<string>();

  rows.forEach((row, idx) => {
    const rowNumber = idx + 2;
    const map = toMap(row);

    const name = toCleanString(getField(map, ["name", "nombre", "titulo", "title"]));
    const slugRaw = toCleanString(getField(map, ["slug"]));
    const descriptionRaw = toCleanString(
      getField(map, ["description", "descripcion", "descripción", "detalle"])
    );
    const priceRaw = getField(map, ["price", "precio", "valor"]);
    const stockRaw = getField(map, ["stock", "cantidad", "qty"]);
    const isActiveRaw = getField(map, ["isActive", "activo", "publicado", "enabled"]);

    if (!name) {
      errors.push({ row: rowNumber, reason: "Nombre requerido." });
      return;
    }

    const slug = slugify(slugRaw || name);
    if (!slug) {
      errors.push({ row: rowNumber, reason: "Slug inválido." });
      return;
    }

    if (seenSlugs.has(slug)) {
      errors.push({ row: rowNumber, slug, reason: "Slug duplicado dentro del archivo." });
      return;
    }
    seenSlugs.add(slug);

    const price = parsePrice(priceRaw);
    if (!Number.isFinite(price) || price <= 0) {
      errors.push({ row: rowNumber, slug, reason: "Precio inválido (debe ser > 0)." });
      return;
    }

    const stock = parseStock(stockRaw);
    if (!Number.isFinite(stock) || stock < 0) {
      errors.push({ row: rowNumber, slug, reason: "Stock inválido (debe ser >= 0)." });
      return;
    }

    const isActive = parseIsActive(isActiveRaw);
    if (isActive === null) {
      errors.push({
        row: rowNumber,
        slug,
        reason: "Valor de activo inválido (usar true/false, si/no, 1/0).",
      });
      return;
    }

    parsed.push({
      rowNumber,
      name,
      slug,
      description: descriptionRaw || null,
      price,
      stock,
      isActive,
    });
  });

  if (parsed.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "No hay filas válidas para importar.",
        summary: {
          totalRows: rows.length,
          created: 0,
          skipped: skipped.length,
          errors: errors.length,
        },
        skipped,
        errors,
      },
      { status: 400 }
    );
  }

  const existing = await prisma.product.findMany({
    where: { slug: { in: parsed.map((r) => r.slug) } },
    select: { slug: true },
  });
  const existingSlugs = new Set(existing.map((p) => p.slug));

  const toCreate = parsed.filter((r) => {
    if (!existingSlugs.has(r.slug)) return true;
    skipped.push({ row: r.rowNumber, slug: r.slug, reason: "El slug ya existe." });
    return false;
  });

  const created: Array<{ row: number; id: string; slug: string; name: string }> = [];

  for (const row of toCreate) {
    try {
      const product = await prisma.product.create({
        data: {
          name: row.name,
          slug: row.slug,
          description: row.description,
          price: row.price.toFixed(2),
          stock: row.stock,
          isActive: row.isActive,
        },
        select: { id: true, slug: true, name: true },
      });

      created.push({
        row: row.rowNumber,
        id: product.id,
        slug: product.slug,
        name: product.name,
      });
    } catch (e: unknown) {
      if (typeof e === "object" && e && "code" in e && (e as { code?: string }).code === "P2002") {
        skipped.push({ row: row.rowNumber, slug: row.slug, reason: "El slug ya existe." });
      } else {
        errors.push({ row: row.rowNumber, slug: row.slug, reason: "Error creando producto." });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    summary: {
      totalRows: rows.length,
      created: created.length,
      skipped: skipped.length,
      errors: errors.length,
    },
    created,
    skipped,
    errors,
  });
}
