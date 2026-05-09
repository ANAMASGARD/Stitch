import type { Metadata } from "next";
import { Archivo_Black, Space_Grotesk, Instrument_Serif, Inter } from "next/font/google";
import Script from "next/script";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryProvider } from "@/components/providers/query-provider";
import "./globals.css";

const archivoBlack = Archivo_Black({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-head",
  display: "swap",
});

const space = Space_Grotesk({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-sans",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Stitch | AI-Powered GitHub Orchestration",
  description: "Your AI-powered GitHub orchestration platform.",
};

/**
 * Prevents Force Of Unstyled Content (FOUC).
 * Injected prior to hydration to synchronously read localStorage and set the `dark` class,
 * avoiding a harsh white flash on initial page load.
 */
const ThemeInitializerScript = () => {
  const cssString = `
    try {
      const theme = localStorage.getItem('theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (theme === 'dark' || (!theme && prefersDark)) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
    } catch (_) {}
  `;
  return (
    <Script id="theme-initializer" strategy="beforeInteractive">
      {cssString}
    </Script>
  );
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${archivoBlack.variable} ${space.variable} ${instrumentSerif.variable} ${inter.variable} h-full antialiased`}
    >
      <head>
        <ThemeInitializerScript />
      </head>
      <body className="min-h-full flex flex-col">
        <QueryProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
