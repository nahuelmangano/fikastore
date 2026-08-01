import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { stockBackInStockTemplate } from "@/lib/email-templates";
import { publicBaseUrl } from "@/lib/publicUrl";
import { getMailingSettings } from "@/lib/storeSettings";

function renderSubject(template: string, productName: string) {
  return template.replaceAll("{{productName}}", productName).trim();
}

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

  if (!mailing.backInStockEnabled) return { sent: 0 };

  for (const notification of pending) {
    if (!notification.user.email) continue;

    try {
      await sendMail({
        to: notification.user.email,
        subject: renderSubject(mailing.backInStockSubject, product.name),
        html: stockBackInStockTemplate({
          customerName: notification.user.name || notification.user.email,
          productName: product.name,
          productUrl: `${baseUrl}/products/${product.slug}`,
          imageUrl: absoluteUrl(product.images[0]?.url, baseUrl),
          message: mailing.backInStockMessage,
        }),
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
