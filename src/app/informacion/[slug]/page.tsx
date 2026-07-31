import Link from "next/link";
import { notFound } from "next/navigation";
import { getInformationSectionBySlug, getInformationSectionExcerpt } from "@/lib/informationSections";
import { sanitizeRichText } from "@/lib/richText";

export async function generateMetadata({
  params,
}: {
  params: { slug?: string } | Promise<{ slug?: string }>;
}) {
  const resolvedParams = await Promise.resolve(params);
  const slug = resolvedParams?.slug?.trim();
  if (!slug) return {};

  const section = await getInformationSectionBySlug(slug);
  if (!section) return {};

  return {
    title: section.title,
    description: getInformationSectionExcerpt(section),
  };
}

export default async function InformationSectionPage({
  params,
}: {
  params: { slug?: string } | Promise<{ slug?: string }>;
}) {
  const resolvedParams = await Promise.resolve(params);
  const slug = resolvedParams?.slug?.trim();
  if (!slug) return notFound();

  const section = await getInformationSectionBySlug(slug);
  if (!section) return notFound();

  return (
    <main className="min-h-screen bg-white text-black">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/" className="hover:text-zinc-600">
            Inicio
          </Link>
          <span>/</span>
          <span>{section.title}</span>
        </nav>

        <section className="mx-auto mt-16 max-w-5xl text-center">
          <h1 className="text-2xl font-normal uppercase tracking-wide">{section.title}</h1>

          {section.content ? (
            <>
              <style>{`
                .information-content,
                .information-content * {
                  color: #18181b !important;
                  opacity: 1 !important;
                }

                .information-content img {
                  color: initial !important;
                }
              `}</style>
              <div
                className="information-content mx-auto mt-16 max-w-5xl text-xl leading-8 text-zinc-900 [&_a]:underline [&_h2]:mb-8 [&_h2]:text-4xl [&_h2]:font-bold [&_h2]:uppercase [&_h2]:underline [&_h3]:mb-5 [&_h3]:text-2xl [&_h3]:font-bold [&_img]:mx-auto [&_img]:my-8 [&_img]:max-w-full [&_li]:my-2 [&_p]:my-6 [&_strong]:font-bold"
                dangerouslySetInnerHTML={{ __html: sanitizeRichText(section.content) }}
              />
            </>
          ) : (
            <p className="mt-12 text-sm text-zinc-500">Esta seccion todavia no tiene contenido.</p>
          )}
        </section>
      </div>
    </main>
  );
}
