import { Rajdhani, Work_Sans } from "next/font/google";
import { SiteSettingsProvider } from "@/components/site-settings-provider";
import { SiteHeader } from "@/components/site-header";
import { buildSiteMetadata } from "@/lib/site-metadata";
import { getCachedSiteSettings } from "@/lib/site-settings";
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

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const siteSettings = await getCachedSiteSettings();
  return buildSiteMetadata(siteSettings);
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const siteSettings = await getCachedSiteSettings();

  return (
    <html lang="pt-BR">
      <body className={`${heading.variable} ${body.variable} bg-canvas text-ink antialiased`}>
        <SiteSettingsProvider initialSettings={siteSettings}>
          <div className="app-bg min-h-screen">
            <SiteHeader />
            <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-5 lg:px-8">{children}</main>
          </div>
        </SiteSettingsProvider>
      </body>
    </html>
  );
}
