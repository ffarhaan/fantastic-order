import "./globals.css";
import type { Metadata } from "next";
import { IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import SystemUpdateNotifier from "@/components/SystemUpdateNotifier";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "fantastic-order — Manajemen Faktur & Penjualan",
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
    <html lang="id" suppressHydrationWarning className={`${ibmPlexSans.variable} ${jetbrainsMono.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('fo_theme');
                  if (saved === 'light') {
                    document.documentElement.classList.remove('dark');
                  } else {
                    document.documentElement.classList.add('dark');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="font-sans font-medium bg-white text-zinc-900 dark:bg-black dark:text-zinc-100 min-h-screen antialiased selection:bg-blue-600/20 selection:text-blue-900 dark:selection:bg-blue-500/30 dark:selection:text-blue-200">
        <SystemUpdateNotifier />
        {children}
      </body>
    </html>
  );
}
