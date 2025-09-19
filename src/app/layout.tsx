// app/layout.tsx
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Montserrat, Covered_By_Your_Grace, Smooch, Anton } from "next/font/google";
import Image from "next/image";
import ClientWrapper from "@/components/ClientWrapper";
import ClientProvider from "@/components/ClientProvider";
import Footer from "@/components/Footer";
import CookieBanner from "@/components/legal/CookieBanner";

const BASE = process.env.NEXT_PUBLIC_BASE_URL || "https://www.sisiciechanow.pl";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(BASE),
  title: { default: "SISI Burger & Pancakes", template: "%s | SISI Burger & Pancakes" },
  description: "Zamów najlepsze burgery i pancakes w Ciechanowie!",
  alternates: {  languages: { "pl-PL": "/" } },
  icons: { icon: "/favicon.ico", apple: "/hamburger.png" },
  openGraph: {
    type: "website",
    url: BASE,
    siteName: "SISI Burger & Pancakes",
    title: "SISI Burger & Pancakes",
    description: "Zamów najlepsze burgery i pancakes w Ciechanowie!",
    images: [{ url: "/og/sisi-og.jpg", width: 1200, height: 630, alt: "SISI Burger & Pancakes" }]
    locale: "pl_PL",
  },
  twitter: {
    card: "summary_large_image",
    title: "SISI Burger & Pancakes",
    description: "Zamów najlepsze burgery i pancakes w Ciechanowie!",
    images: ["/og-cover.jpg"],
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, notranslate: true } },
  verification: { google: "oR0w6Flg2I5VDVAjQlECqUmuTE2wFCPEzo9lW37XFDE" },
};

// — JSON-LD
const restaurantLd = {
  "@context": "https://schema.org",
  "@type": "Restaurant",
  name: "SISI Burger & Pancakes",
  url: BASE,
  telephone: "+48515433488",
  image: [`${BASE}/og-cover.jpg`],
  logo: `${BASE}/logo.png`,
  menu: `${BASE}/menu`,
  priceRange: "PLN 20–80",
  address: {
    "@type": "PostalAddress",
    streetAddress: "ul. Spółdzielcza 7",
    postalCode: "06-400",
    addressLocality: "Ciechanów",
    addressCountry: "PL",
  },
  servesCuisine: ["Burgers", "Pancakes"],
  acceptsReservations: true,
  openingHoursSpecification: [
    { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday","Tuesday","Wednesday","Thursday"], opens: "12:00", closes: "22:00" },
    { "@type": "OpeningHoursSpecification", dayOfWeek: ["Friday","Saturday"], opens: "12:00", closes: "23:00" },
    { "@type": "OpeningHoursSpecification", dayOfWeek: "Sunday", opens: "12:00", closes: "22:00" },
  ],
  sameAs: ["https://www.facebook.com/sisiciechanow","https://www.instagram.com/sisiciechanow"],
};

const montserrat = Montserrat({ subsets: ["latin"], weight: ["400","500","700","800","900"], display: "swap" });
const covered = Covered_By_Your_Grace({ subsets: ["latin"], weight: "400", variable: "--font-covered" });
const smooch = Smooch({ subsets: ["latin"], weight: ["400"], variable: "--font-smooch", display: "swap" });
const anton = Anton({ subsets: ["latin"], weight: ["400"], variable: "--font-anton", display: "swap" });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(restaurantLd) }} />
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body className={`${montserrat.className} ${covered.variable} ${smooch.variable} ${anton.variable} bg-[#fff800] text-black relative overflow-x-hidden`}>
        {/* Mobile tło – nie łapie tapów */}
        <div
          className="md:hidden fixed inset-0 -z-10 bg-[url('/backgroundsisi.jpg')] bg-center bg-cover pointer-events-none select-none"
          aria-hidden="true"
        />
        {/* Desktop tło – nie łapie tapów */}
        <Image
          src="/grafittiburger2.jpg"
          alt=""
          fill
          priority
          className="hidden md:block object-cover opacity-20 pointer-events-none select-none -z-10"
        />
        <ClientProvider>
          <ClientWrapper>{children}</ClientWrapper>
        </ClientProvider>
        <Footer />
        <CookieBanner />
      </body>
    </html>
  );
}
