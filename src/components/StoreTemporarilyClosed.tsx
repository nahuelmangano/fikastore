export default function StoreTemporarilyClosed({ message }: { message: string }) {
  return (
    <main className="min-h-screen bg-white text-black">
      <section className="mx-auto flex max-w-3xl flex-col items-center px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold uppercase tracking-wide">Tienda apagada temporalmente</h1>
        <p className="mt-6 text-base leading-7 text-zinc-600">{message}</p>
      </section>
    </main>
  );
}
