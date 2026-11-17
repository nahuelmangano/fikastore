"use client";

import { CreditCard, Tag, Truck } from "lucide-react";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { splitAnnouncementBenefit } from "@/lib/announcement";

const BENEFIT_ICONS: LucideIcon[] = [CreditCard, Tag, Truck];

export default function AnnouncementBar({ text }: { text: string }) {
  const pathname = usePathname();
  const [activeIndex, setActiveIndex] = useState(0);
  const cleanText = text.trim();

  const benefits = useMemo(
    () =>
      cleanText
        .split("|")
        .map((part, index) => ({ ...splitAnnouncementBenefit(part), Icon: BENEFIT_ICONS[index] || Tag }))
        .slice(0, 3),
    [cleanText]
  );
  const mobileBenefits = useMemo(() => {
    const rank = (title: string) => {
      if (title.includes("15%")) return 0;
      if (title.includes("CUOTAS")) return 1;
      return 2;
    };
    return [...benefits].sort((a, b) => rank(a.title) - rank(b.title));
  }, [benefits]);
  const activeBenefit = mobileBenefits[activeIndex % Math.max(1, mobileBenefits.length)];

  useEffect(() => {
    if (mobileBenefits.length <= 1) return;
    const id = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % mobileBenefits.length);
    }, 3500);
    return () => window.clearInterval(id);
  }, [mobileBenefits.length]);

  if (!cleanText || pathname.startsWith("/admin") || benefits.length === 0) return null;

  return (
    <div className="w-full bg-[#070707] text-white">
      {activeBenefit ? (
        <div className="flex min-h-12 items-center justify-center gap-3 px-4 py-2 sm:hidden">
          <activeBenefit.Icon className="h-5 w-5 shrink-0 text-[#B9824A]" aria-hidden="true" />
          <div className="text-left leading-tight">
            <div className="text-xs font-bold tracking-wide">{activeBenefit.title}</div>
            {activeBenefit.subtitle ? <div className="mt-0.5 text-[11px] font-medium text-white">{activeBenefit.subtitle}</div> : null}
          </div>
        </div>
      ) : null}

      <div className="mx-auto hidden max-w-6xl grid-cols-3 divide-x divide-white/20 px-4 py-3 sm:grid sm:px-6">
        {benefits.map(({ title, subtitle, Icon }) => (
          <div key={title} className="flex items-center justify-center gap-3 py-0">
            <Icon className="h-5 w-5 shrink-0 text-[#B9824A]" aria-hidden="true" />
            <div className="text-left leading-tight">
              <div className="text-xs font-bold tracking-wide">{title}</div>
              {subtitle ? <div className="mt-0.5 text-[11px] font-medium normal-case text-white">{subtitle}</div> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
