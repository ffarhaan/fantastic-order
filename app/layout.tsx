import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "fantastic-order — Deployments & Logistics Hub",
  description: "Platform Terpadu Pengelolaan Faktur, Tracking Retur, dan Direktori Master Customer",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className="dark">
      <body className="bg-black text-zinc-100 min-h-screen antialiased selection:bg-blue-600/30 selection:text-blue-200">
        {children}
      </body>
    </html>
  );
}
