import "./globals.css";
import type { Metadata } from "next";

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
    <html lang="id" suppressHydrationWarning>
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
      <body className="bg-[#f8fafc] text-zinc-900 dark:bg-black dark:text-zinc-100 min-h-screen antialiased selection:bg-blue-600/20 selection:text-blue-900 dark:selection:bg-blue-600/30 dark:selection:text-blue-200 transition-colors">
        {children}
      </body>
    </html>
  );
}
