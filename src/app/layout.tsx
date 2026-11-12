import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { MobileNav, Sidebar } from "@/components/shell";
import { StatusProvider } from "@/components/status";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin", "cyrillic"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  title: "Sputnik — радар игрового рынка",
  description: "Каждый час собирает новые игры с Metacritic: ИИ-сводки отзывов, выводы по летсплеям и аналитика рынка.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${geist.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full">
        <StatusProvider>
          <Sidebar />
          <MobileNav />
          <main className="relative min-h-screen md:pl-60">{children}</main>
        </StatusProvider>
      </body>
    </html>
  );
}
