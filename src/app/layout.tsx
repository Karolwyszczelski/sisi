import './globals.css';
import type { Metadata } from 'next';
import { Montserrat, Covered_By_Your_Grace, Smooch, Anton } from 'next/font/google';
import ClientWrapper from '@/components/ClientWrapper';
import Image from 'next/image';
import CheckoutModalDynamic from '@/components/CheckoutModalDynamic';

export const metadata: Metadata = {
  title: 'SISI Ordering',
  description: 'Zamów najlepsze burgery i pancakes w Ciechanowie!',
};

// Czcionki
const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '700', '800','900'],
  display: 'swap',
});

const covered = Covered_By_Your_Grace({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-covered',
});

const smooch = Smooch({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-smooch',
  display: 'swap',
});

const anton = Anton({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-anton',
  display: 'swap',
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

        {/* 🎨 Graffiti */}
        <Image
          src="/grafittiburger2.jpg"
          alt=""
          fill
          className="object-cover opacity-20 pointer-events-none select-none -z-10"
        />

        {/* 🔝 Wszystkie komponenty klientowe */}
        <ClientWrapper>
          {children}
          {/* Modal wczytywany dynamicznie (bez SSR) */}
          <CheckoutModalDynamic />
        </ClientWrapper>
      </body>
    </html>
  );
}
