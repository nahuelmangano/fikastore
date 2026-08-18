"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { HomeBannerSettings } from "@/lib/storeSettings";

export default function HomeBannerCarousel({ settings }: { settings: HomeBannerSettings }) {
  const slides = settings.enabled ? settings.slides.filter((slide) => slide.imageUrl.trim()) : [];
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return;

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [slides.length]);

  if (slides.length === 0) return null;

  const activeSlide = slides[Math.min(activeIndex, slides.length - 1)];
  const showPrevious = () => setActiveIndex((current) => (current - 1 + slides.length) % slides.length);
  const showNext = () => setActiveIndex((current) => (current + 1) % slides.length);
  const content = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={activeSlide.imageUrl} alt={activeSlide.title || "Banner"} className="h-full w-full object-cover" />
      <div className="absolute inset-0 bg-black/35" />
      <div className="absolute inset-0 flex flex-col items-center justify-center px-5 text-center text-white">
        {activeSlide.title ? (
          <h1 className="max-w-5xl text-3xl font-bold uppercase leading-tight tracking-[0.18em] sm:text-4xl lg:text-5xl">
            {activeSlide.title}
          </h1>
        ) : null}
        {activeSlide.subtitle ? (
          <p className="mt-3 max-w-4xl text-sm font-medium uppercase leading-6 tracking-[0.22em] sm:text-base lg:text-lg">
            {activeSlide.subtitle}
          </p>
        ) : null}
      </div>
      {slides.length > 1 ? (
        <>
          <button
            type="button"
            aria-label="Banner anterior"
            onClick={(event) => {
              event.preventDefault();
              showPrevious();
            }}
            className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white transition hover:bg-black/55 sm:left-5 sm:h-12 sm:w-12"
          >
            <ChevronLeft className="h-6 w-6" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Banner siguiente"
            onClick={(event) => {
              event.preventDefault();
              showNext();
            }}
            className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white transition hover:bg-black/55 sm:right-5 sm:h-12 sm:w-12"
          >
            <ChevronRight className="h-6 w-6" aria-hidden="true" />
          </button>
          <div className="absolute bottom-5 left-0 right-0 flex justify-center gap-2">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                aria-label={`Mostrar banner ${index + 1}`}
                onClick={(event) => {
                  event.preventDefault();
                  setActiveIndex(index);
                }}
                className={[
                  "h-2.5 w-2.5 rounded-full border border-white/80 transition",
                  index === activeIndex ? "bg-white" : "bg-white/30 hover:bg-white/60",
                ].join(" ")}
              />
            ))}
          </div>
        </>
      ) : null}
    </>
  );

  return (
    <div className="w-full overflow-hidden">
      {activeSlide.href ? (
        <Link href={activeSlide.href} className="relative block aspect-[16/7] min-h-[280px] w-full overflow-hidden">
          {content}
        </Link>
      ) : (
        <div className="relative aspect-[16/7] min-h-[280px] w-full overflow-hidden">{content}</div>
      )}
    </div>
  );
}
