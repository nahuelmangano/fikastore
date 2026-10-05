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
    <main className="min-h-screen bg-white text-[#70471F]">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/" className="hover:text-zinc-600">
            Inicio
          </Link>
          <span>/</span>
          <span>{section.title}</span>
        </nav>

        <section className="mx-auto mt-16 max-w-5xl">
          <h1 className="text-center text-2xl font-normal uppercase tracking-wide">{section.title}</h1>

          {section.content ? (
            <>
              <style>{`
                .information-content,
                .information-content * {
                  color: #70471F !important;
                  opacity: 1 !important;
                }

                .information-content img {
                  color: initial !important;
                }
              `}</style>
              <div
                className="information-content mx-auto mt-16 max-w-4xl text-left text-lg leading-8 text-[#70471F] [&_a]:font-semibold [&_a]:underline [&_h2]:mb-8 [&_h2]:mt-10 [&_h2]:text-left [&_h2]:text-2xl [&_h2]:font-normal [&_h2]:uppercase [&_h3]:mb-5 [&_h3]:mt-8 [&_h3]:text-left [&_h3]:text-xl [&_h3]:font-normal [&_img]:mx-auto [&_img]:my-8 [&_img]:max-w-full [&_li]:my-2 [&_li]:text-left [&_ol]:my-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-6 [&_p]:text-left [&_strong]:font-bold [&_ul]:my-6 [&_ul]:list-disc [&_ul]:pl-6"
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
