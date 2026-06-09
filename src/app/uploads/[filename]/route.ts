import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const CONTENT_TYPES: Record<string, string> = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

export async function GET(_: Request, { params }: { params: Promise<{ filename?: string }> }) {
  const { filename } = await params;
  const safeFilename = path.basename(String(filename || ""));

  if (!safeFilename || safeFilename !== filename) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  const filePath = path.join(uploadsDir, safeFilename);

  try {
    const file = await readFile(filePath);
    const ext = path.extname(safeFilename).toLowerCase();

    return new NextResponse(file, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": CONTENT_TYPES[ext] || "application/octet-stream",
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
}
