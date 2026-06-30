import type { Metadata } from "next";
import { Inter, Bebas_Neue, Geist_Mono } from "next/font/google";
import "./globals.css";

import { ThemeProvider } from "@/components/theme-provider";
import { QueryProvider } from "@/providers/query-provider";
import { Toaster } from "@/components/ui/sonner";

// Inter for all UI/body (Helvetica Now substitute).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Bebas Neue: condensed uppercase display, the Futura ND substitute for the
// towering campaign headline tier. Single weight (400).
const bebas = Bebas_Neue({
  variable: "--font-bebas",
  subsets: ["latin"],
  weight: ["400"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Instagram Tools",
  description: "A collection of tools for Instagram. Transcribe reels and more.",
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
      className={`${inter.variable} ${bebas.variable} ${geistMono.variable}`}
    >
      <body suppressHydrationWarning className="min-h-svh antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            {children}
            <Toaster richColors position="top-center" />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
