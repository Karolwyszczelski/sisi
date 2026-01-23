// src/components/ContactSection.tsx
"use client";

import QRCode from "react-qr-code";

const REVIEW_URL = "https://g.co/kgs/47NSDMH";

export default function ContactSection() {
  return (
    <section id="kontakt" className="mt-0 bg-black text-white py-10 px-6 md:px-16 w-full relative">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Lewa kolumna – Kontakt + „Oceń nas” + QR */}
        <div className="flex flex-col gap-6 items-center md:items-start text-center md:text-left">
          {/* Kontakt */}
          <div className="w-full">
            <h3 className="text-xl font-bold mb-2">Gdzie nas znajdziesz?</h3>
            <p className="text-sm mb-4">ul. Spółdzielcza 7, Ciechanów 06-400</p>
            <p className="text-sm mb-4">
              <strong>Godziny otwarcia:</strong>
              <br />
              Pon - Czw: 11:00 - 22:00
              <br />
              Pt - Sob: 11:00 - 24:00 - Bar
              <br />
              Pt - Sob: 11:00 - 22:00 - Kuchnia
              <br />
              Niedziela: 11:00 - 22:00
              <br />
            </p>
            <p className="text-sm mb-4">
              <strong>Telefon:</strong>{" "}
              <a href="tel:+48515433488" className="underline hover:text-primary">
                +48 515 433 488
              </a>
              <br />
              <strong>Email:</strong>{" "}
              <a href="mailto:kontakt@sisiburger.pl" className="underline hover:text-primary">
                kontakt@sisiburger.pl
              </a>
            </p>
          </div>

          {/* „Oceń nas” + QR */}
          <div className="w-full">
            <h4 className="text-lg font-bold mb-2">Oceń nas!</h4>
            <p className="text-sm">Zostaw opinię w Google, abyśmy mogli stale ulepszać nasze smaki.</p>
            <div className="mt-4 inline-block rounded-md bg-white p-3 shadow mx-auto md:mx-0">
              <QRCode value={REVIEW_URL} size={140} />
            </div>
            <p className="mt-2 text-xs text-neutral-300">
              Zeskanuj kod lub{" "}
              <a href={REVIEW_URL} target="_blank" rel="noopener noreferrer" className="underline">
                kliknij tutaj
              </a>
              .
            </p>
          </div>
        </div>

        {/* Prawa kolumna – Mapa */}
        <div className="flex flex-col items-center md:items-end">
          <div className="w-full max-w-xl md:max-w-none">
            <iframe
              title="Mapa"
              src="https://www.google.com/maps?q=Spółdzielcza+7,+Ciechanów+06-400&output=embed"
              className="w-full h-[300px] sm:h-[380px] border-0 rounded-md"
              allowFullScreen
              loading="lazy"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
