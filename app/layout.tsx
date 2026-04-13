import type { Metadata } from "next";
import { Archivo_Black, Space_Grotesk } from "next/font/google";
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
  return <script dangerouslySetInnerHTML={{ __html: cssString }} />;
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
      className={`${archivoBlack.variable} ${space.variable} h-full antialiased`}
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
