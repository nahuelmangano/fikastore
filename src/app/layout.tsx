import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AuthSessionProvider from "@/components/SessionProvider";
import CartSync from "@/components/CartSync";
import AnnouncementBar from "@/components/AnnouncementBar";
import StoreNav from "@/components/StoreNav";
import StorefrontOnly from "@/components/StorefrontOnly";
import { getAnnouncementText, getFaviconUrl, getSiteTitle } from "@/lib/storeSettings";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const [title, faviconUrl] = await Promise.all([getSiteTitle(), getFaviconUrl()]);

  return {
    title,
    description: title,
    icons: {
      icon: faviconUrl,
      shortcut: faviconUrl,
      apple: faviconUrl,
    },
  };
}

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const announcementText = await getAnnouncementText();

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthSessionProvider>
          <StorefrontOnly>
            <AnnouncementBar text={announcementText} />
            <StoreNav />
          </StorefrontOnly>
          <CartSync />
          {children}
        </AuthSessionProvider>
      </body>
    </html>
  );
}
