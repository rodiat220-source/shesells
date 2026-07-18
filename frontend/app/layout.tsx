import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("http://localhost:3000"),
  title: "SheSells · AI 销售教练",
  description: "教的不是话术，是懂她的能力。面向美妆销售顾问的 AI 实战陪练。",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "SheSells · AI 销售教练",
    description: "教的不是话术，是懂她的能力。",
    images: [{ url: "/og.png", width: 1536, height: 1024, alt: "SheSells AI 销售教练" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "SheSells · AI 销售教练",
    description: "教的不是话术，是懂她的能力。",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning data-scroll-behavior="smooth">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
