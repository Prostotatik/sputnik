import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { MobileNav, Sidebar } from "@/components/shell";
import { StatusProvider } from "@/components/status";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin", "cyrillic"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  title: "Sputnik — game market radar",
  description: "Hourly Metacritic tracker with AI review summaries, let's-play insights and market analytics.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} h-full`}>
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
