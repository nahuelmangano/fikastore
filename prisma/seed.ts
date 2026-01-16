import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = "mangano.nahuel@gmail.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "Admin123!Cambiar";
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  // 1) Admin (upsert)
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      role: "admin",
      passwordHash,
      name: "Nahuel",
    },
    create: {
      email: adminEmail,
      role: "admin",
      passwordHash,
      name: "Nahuel",
    },
  });

  // 2) Productos demo (upsert por slug)
  const products = [
    {
      name: "Pijama Pant Galaxias",
      slug: "pijama-pant-galaxias",
      description: "Pijama pant súper cómodo, ideal para noches frescas.",
      price: "19999.00",
      stock: 25,
      images: [
        "https://placehold.co/900x900/png?text=Galaxias+1",
        "https://placehold.co/900x900/png?text=Galaxias+2",
      ],
    },
    {
      name: "Remerón Gatitos",
      slug: "remeron-gatitos",
      description: "Remerón oversize suave, con estampa de gatitos.",
      price: "14999.00",
      stock: 40,
      images: ["https://placehold.co/900x900/png?text=Gatitos+1"],
    },
    {
      name: "Remerón Perritos",
      slug: "remeron-perritos",
      description: "Remerón oversize, ideal para estar en casa con estilo.",
      price: "14999.00",
      stock: 35,
      images: ["https://placehold.co/900x900/png?text=Perritos+1"],
    },
  ];

  for (const p of products) {
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        description: p.description,
        price: p.price as any, // Prisma Decimal acepta string
        stock: p.stock,
        isActive: true,
      },
      create: {
        name: p.name,
        slug: p.slug,
        description: p.description,
        price: p.price as any,
        stock: p.stock,
        isActive: true,
      },
    });

    // Limpia imágenes y las vuelve a crear (para no duplicar)
    await prisma.productImage.deleteMany({ where: { productId: product.id } });
    await prisma.productImage.createMany({
      data: p.images.map((url, idx) => ({
        productId: product.id,
        url,
        sortOrder: idx,
      })),
    });
  }

  console.log("✅ Seed OK");
  console.log("Admin:", admin.email);
  console.log("Password (env ADMIN_PASSWORD):", process.env.ADMIN_PASSWORD ? "set" : "DEFAULT Admin123!Cambiar");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
