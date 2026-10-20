import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Fantastic Order — Unified Faktur, Retur & Customer Hub",
  description: "Platform Terpadu Faktur Tracker, Retur & Shipment Error, dan Direktori Master Customer",
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
    <html lang="id">
      <body className="bg-slate-950 text-slate-100 min-h-screen antialiased selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
