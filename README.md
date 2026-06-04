# FikaStore

Resumen del proyecto

FikaStore es un e-commerce desarrollado con Next.js (App Router) y TypeScript. Incluye funcionalidades completas para venta online: catálogo y gestión de productos, carrito de compras, proceso de checkout, pasarelas de pago, gestión de usuarios y pedidos, y un panel de administración.

Características principales

- Frontend en Next.js (App Router) con componentes reutilizables para carrito, checkout y sesión.
- Autenticación y cuentas de usuario, historial de pedidos y páginas de cuenta.
- Carrito sincronizado y flujo de checkout completo.
- Integración con múltiples proveedores de envío (E-pick, Andreani, Correo Argentino) con cotización, creación de envíos, etiquetas y tracking.
- Panel administrativo para productos, pedidos, usuarios, promociones, paquetería y estadísticas.
- Promociones y cupones, gestión de descuentos.
- Notificaciones por email (plantillas y envío) y webhooks para eventos externos.
- Tareas programadas/cron para recordatorios (carritos abandonados, etc.).
- Persistencia con Prisma (migraciones y seed) y almacenamiento de archivos en `public/uploads`.

Getting started

Instalar dependencias y ejecutar en modo desarrollo:

```bash
npm install
npm run dev
# o: pnpm install && pnpm dev
```

Abre http://localhost:3000 en tu navegador.

Estructura y puntos importantes

- Rutas de la app y páginas bajo `app/`.
- APIs en `src/app/api/` para `auth`, `cart`, `checkout`, `orders`, `payments`, `shipping`, `epick`, `promotions`, `webhooks`, etc.
- Lógica reusable en `src/lib/` (envíos, mailer, promociones, prisma, carriers).
- Componentes UI en `src/components/` (AddToCartButton, CartPanel, CheckoutClient, SiteHeader, etc.).
- Prisma schema en `prisma/schema.prisma` y scripts de seed/migrations en `prisma/`.

E-pick (envíos)

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

Ejemplos

Cotización:
```bash
curl -X POST http://localhost:3000/api/shipping/quote \
  -H "Content-Type: application/json" \
  -d '{"postalCode":"1414"}'
```

Crear envío:
```bash
curl -X POST http://localhost:3000/api/shipping/create \
  -H "Content-Type: application/json" \
  -d '{"orderId":"ORDER_ID"}'
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
curl "http://localhost:3000/api/shipping/label/ORDER_ID?type=normal"
```

