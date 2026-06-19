"use client";

import { usePathname } from "next/navigation";

export default function AnnouncementBar({ text }: { text: string }) {
  const pathname = usePathname();
  const cleanText = text.trim();

  if (!cleanText || pathname.startsWith("/admin")) return null;

  return (
    <div className="w-full bg-black px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-white sm:text-sm">
      {cleanText}
    </div>
  );
}
