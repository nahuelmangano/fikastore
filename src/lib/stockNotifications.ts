import { prisma } from "@/lib/prisma";
import { publicBaseUrl } from "@/lib/publicUrl";
import { getMailingSettings } from "@/lib/storeSettings";
import { queueAndSendEmailNotification } from "@/lib/emailNotificationService";
import { emailProductRowsHtml } from "@/lib/emailProductRows";

function absoluteUrl(value: string | null | undefined, baseUrl: string) {
  const url = String(value || "").trim();
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return `${baseUrl}${url.startsWith("/") ? url : `/${url}`}`;
}

export async function notifyBackInStock(productId: string, req?: Request) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      images: {
        where: { visible: true },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        take: 1,
      },
    },
  });

  if (!product || !product.isActive || product.stock <= 0) return { sent: 0 };

  const pending = await prisma.stockNotification.findMany({
    where: { productId, status: "pending" },
    include: { user: { select: { email: true, name: true } } },
  });

  let sent = 0;
  const baseUrl = publicBaseUrl(req);
  const mailing = await getMailingSettings();
  const imageUrl = absoluteUrl(product.images[0]?.url, baseUrl);

  if (!mailing.backInStockEnabled) return { sent: 0 };

  for (const notification of pending) {
    if (!notification.user.email) continue;

    try {
      await queueAndSendEmailNotification({
        templateKey: "back-in-stock",
        to: notification.user.email,
        recipientUserId: notification.userId,
        productId: product.id,
        idempotencyKey: `back-in-stock:${notification.id}`,
        payload: {
          customerName: notification.user.name || notification.user.email,
          productName: product.name,
          productHtml: emailProductRowsHtml([
            { name: product.name, imageUrl, details: ["Disponible nuevamente"] },
          ]),
          productUrl: `${baseUrl}/products/${product.slug}`,
          imageUrl,
          storeName: "FikaStore",
          storeUrl: baseUrl,
        },
      });

      await prisma.stockNotification.update({
        where: { id: notification.id },
        data: { status: "notified", notifiedAt: new Date() },
      });

      sent += 1;
    } catch {
      // Si falla el email, queda pending para poder reintentar cuando se vuelva a actualizar stock.
    }
  }

  return { sent };
}
