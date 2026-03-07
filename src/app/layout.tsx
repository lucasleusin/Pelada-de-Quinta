import type { Metadata } from "next";
import { Rajdhani, Work_Sans } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const heading = Rajdhani({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const body = Work_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Pelada da Quinta",
  description: "Gestao da pelada semanal de Cachoeira do Sul",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${heading.variable} ${body.variable} bg-canvas text-ink antialiased`}>
        <div className="app-bg min-h-screen">
          <SiteHeader />
          <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-5 lg:px-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
