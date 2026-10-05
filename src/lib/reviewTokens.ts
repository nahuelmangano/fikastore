import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/emailNotificationService";

export async function validateProductReviewToken(rawToken: string) {
  const token = rawToken.trim();
  if (!token) return { ok: false as const, error: "El enlace no es válido." };

  const tokenHash = hashToken(token);
  const record = await prisma.productReviewToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      usedAt: true,
      expiresAt: true,
      order: {
        select: {
          id: true,
          orderNumber: true,
          contactEmail: true,
          user: {
            select: {
              email: true,
            },
          },
        },
      },
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          images: {
            where: { visible: true },
            orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
            take: 1,
            select: {
              url: true,
            },
          },
        },
      },
    },
  });

  if (!record) return { ok: false as const, error: "El enlace no es válido." };
  if (record.usedAt) return { ok: false as const, error: "Este enlace ya fue utilizado." };
  if (record.expiresAt.getTime() < Date.now()) return { ok: false as const, error: "Este enlace ya venció." };

  return {
    ok: true as const,
    reviewToken: {
      id: record.id,
      orderId: record.order.id,
      orderNumber: record.order.orderNumber,
      accessEmail: (record.order.contactEmail || record.order.user?.email || "").trim().toLowerCase(),
      product: {
        id: record.product.id,
        name: record.product.name,
        slug: record.product.slug,
        imageUrl: record.product.images[0]?.url || null,
      },
    },
  };
}
