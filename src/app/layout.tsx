// src/app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import {
  Montserrat,
  Covered_By_Your_Grace,
  Smooch,
  Anton,
  Pinyon_Script,
} from "next/font/google";
import Image from "next/image";
import ClientWrapper from "@/components/ClientWrapper";
import ClientProvider from "@/components/ClientProvider";
import Footer from "@/components/Footer";
import CookieBanner from "@/components/legal/CookieBanner";

export const metadata: Metadata = {
  title: "SISI Burger & Pancakes",
  description: "Zamów najlepsze burgery i pancakes w Ciechanowie!",
  icons: {
    icon: "/favicon.ico",
    apple: "/hamburger.png",
  },
};

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800", "900"],
  display: "swap",
});
const covered = Covered_By_Your_Grace({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-covered",
});
const smooch = Smooch({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-smooch",
  display: "swap",
});
const anton = Anton({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-anton",
  display: "swap",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body
        className={`
          ${montserrat.className}
          ${covered.variable}
          ${smooch.variable}
          ${anton.variable}
          bg-[#fff800]
          text-black
          relative
          overflow-x-hidden
        `}
      >
        {/* Tło tylko na mobile */}
        <div
          className="md:hidden fixed inset-0 -z-10 bg-[url('/backgroundsisi.jpg')] bg-center bg-cover"
          aria-hidden="true"
        />

        {/* Tło desktop jak było */}
        <Image
          src="/grafittiburger2.jpg"
          alt=""
          fill
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
