import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AddToCartButton from "@/components/AddToCartButton";


export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    if (!slug) return notFound();

    const product = await prisma.product.findUnique({
        where: { slug },
        include: { images: { orderBy: { sortOrder: "asc" } } },
    });

    if (!product || !product.isActive) return notFound();

    const img = product.images[0]?.url ?? "https://placehold.co/900x900/png?text=Fika";
    const priceNumber = Number(product.price);
    return (
        <main className="min-h-screen bg-zinc-950 text-zinc-100">
            <div className="mx-auto max-w-5xl px-4 py-10">
                <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-200">
                    ← Volver
                </Link>

                <div className="mt-6 grid gap-8 lg:grid-cols-2">
                    <div className="aspect-square overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img} alt={product.name} className="h-full w-full object-cover" />
                    </div>

                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
                        <div className="mt-3 text-2xl font-bold">
                            ${Number(product.price).toLocaleString("es-AR")}
                        </div>

                        <p className="mt-4 text-zinc-300">
                            {product.description ?? "Producto Fika."}
                        </p>

                        <div className="mt-4 text-sm text-zinc-400">Stock: {product.stock}</div>

                        {/* Botón placeholder: después lo conectamos al carrito */}
                        <AddToCartButton
                            product={{
                                id: product.id,
                                slug: product.slug,
                                name: product.name,
                                price: priceNumber,
                                stock: product.stock,
                                imageUrl: img,
                            }}
                        />



                        {product.images.length > 1 && (
                            <div className="mt-6 grid grid-cols-4 gap-3">
                                {product.images.slice(0, 4).map((im) => (
                                    <div
                                        key={im.id}
                                        className="aspect-square overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900"
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={im.url} alt={product.name} className="h-full w-full object-cover" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
}
