This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## E-pick (envios)

### Variables de entorno

- `EPICK_BASE_URL` (opcional, default `https://dev-ar.e-pick.com.ar`)
- `EPICK_PHONE` (login E-pick, debe coincidir con `EPICK_SENDER_PHONE`)
- `EPICK_PASSWORD`
- `EPICK_WEBHOOK_URL` (por ejemplo `https://TU_DOMINIO/api/epick/webhook`)
- `EPICK_SENDER_NAME`
- `EPICK_SENDER_PHONE`
- `EPICK_SENDER_EMAIL`
- `EPICK_SENDER_STREET`
- `EPICK_SENDER_NUMBER`
- `EPICK_SENDER_CITY`
- `EPICK_SENDER_PROVINCE`
- `EPICK_SENDER_POSTAL_CODE`
- `EPICK_SENDER_EXTRA` (opcional)
- `EPICK_SENDER_INFO` (opcional)
- `EPICK_ADDRESSEE_PROVINCE` (opcional, fallback)
- `EPICK_PKG_LONG` (cm, default 30)
- `EPICK_PKG_WIDTH` (cm, default 20)
- `EPICK_PKG_HEIGHT` (cm, default 10)
- `EPICK_PKG_WEIGHT` (kg, default 1)

### Endpoints internos

- `POST /api/shipping/quote`
- `POST /api/shipping/create`
- `GET /api/shipping/confirm/:orderId`
- `GET /api/shipping/tracking/:id`
- `POST /api/epick/webhook`
- `GET /api/shipping/label/:ids?type=normal|thermal`

### Ejemplos

Cotizacion:
```bash
curl -X POST http://localhost:3000/api/shipping/quote \\
  -H \"Content-Type: application/json\" \\
  -d '{\"postalCode\":\"1414\"}'
```

Crear envio:
```bash
curl -X POST http://localhost:3000/api/shipping/create \\
  -H \"Content-Type: application/json\" \\
  -d '{\"orderId\":\"ORDER_ID\"}'
```

Confirmar retiro:
```bash
curl http://localhost:3000/api/shipping/confirm/ORDER_ID
```

Tracking:
```bash
curl http://localhost:3000/api/shipping/tracking/ORDER_ID
```

Etiqueta:
```bash
curl \"http://localhost:3000/api/shipping/label/ORDER_ID?type=normal\"
```
