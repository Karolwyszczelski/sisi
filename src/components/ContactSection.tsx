// src/components/ContactSection.tsx
"use client";

export default function ContactSection() {
  return (
    <section id="kontakt" className="mt-0 bg-black text-white py-10 px-8 md:px-16 w-full relative">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Lewa kolumna – Kontakt + „Oceń nas” + QR */}
        <div className="flex flex-col gap-6">
          {/* Kontakt */}
          <div>
            <h3 className="text-xl font-bold mb-2">Gdzie nas znajdziesz?</h3>
            <p className="text-sm mb-4">ul. Spółdzielcza 7, Ciechanów 06-400</p>
            <p className="text-sm mb-4">
              <strong>Godziny otwarcia:</strong>
              <br />
              Pon - Pt: 10:00 - 20:00
              <br />
              Sob - Nd: 11:00 - 22:00
            </p>
            <p className="text-sm mb-4">
              <strong>Telefon:</strong>{" "}
              <a href="tel:123456789" className="underline hover:text-primary">
                123 456 789
              </a>
              <br />
              <strong>Email:</strong>{" "}
              <a href="mailto:kontakt@sisiburger.pl" className="underline hover:text-primary">
                kontakt@sisiburger.pl
              </a>
            </p>
          </div>

          {/* „Oceń nas” z tekstem i kodem QR */}
          <div>
            <h4 className="text-lg font-bold mb-2">Oceń nas!</h4>
            <p className="text-sm">
              Zostaw opinię w Google, abyśmy mogli stale ulepszać nasze smaki.
            </p>
            <div className="mt-4">
              {/* Zastąp /qr.png swoim plikiem QR w public/ */}
              <img
                src="/qr.png"
                alt="Kod QR do opinii Google"
                className="object-contain w-20 h-20"
              />
            </div>
          </div>
        </div>

        {/* Prawa kolumna – Mapa */}
        <div className="flex flex-col items-start md:items-end">
          <iframe
            title="Mapa"
            src="https://www.google.com/maps/place/Spółdzielcza+7,+Ciechanów+06-400/@52.8833012,20.5997877,17z/"
            width="100%"
            height="400"
            className="border-0 rounded-md"
            allowFullScreen
            loading="lazy"
          ></iframe>
        </div>
      </div>
    </section>
  );
}
