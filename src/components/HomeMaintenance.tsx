import Image from "next/image";
import { Phone } from "lucide-react";

export default function HomeMaintenance() {
  return (
    <main className="grid min-h-[100svh] place-items-center bg-[#fff800] px-6 py-14 text-[#171714] sm:px-12 sm:py-20">
      <div className="w-full max-w-[58rem]">
        <Image
          src="/logo.png"
          alt="SISI Burger & Pancakes"
          width={120}
          height={120}
          priority
          className="mb-9 h-[88px] w-[88px] object-contain sm:mb-12 sm:h-[120px] sm:w-[120px]"
        />
        <h1 className="font-[family-name:var(--font-anton)] text-[clamp(3.4rem,10.5vw,8.25rem)] uppercase leading-[0.98]">
          Przerwa<br />techniczna
        </h1>
        <p className="mt-6 max-w-[32rem] text-lg font-semibold leading-snug sm:mt-8 sm:text-2xl">
          Strona jest chwilowo nieaktywna. Wracamy niebawem.
        </p>
        <a
          href="tel:+48515433488"
          className="mt-8 inline-flex min-h-14 max-w-full items-center gap-3 rounded-md bg-[#171714] px-5 py-3.5 text-base font-bold text-white transition-colors hover:bg-[#34342c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#171714] sm:px-6"
        >
          <Phone size={20} aria-hidden="true" className="shrink-0" />
          Zadzwoń do restauracji
        </a>
        <p className="mt-3 text-sm font-semibold tabular-nums">+48 515 433 488</p>
      </div>
    </main>
  );
}
