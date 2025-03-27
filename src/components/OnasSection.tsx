"use client";

import Image from "next/image";

export default function OnasSection() {
  return (
    <section
      id="onas"
      className="relative w-full bg-yellow-400 text-black pt-16 pb-20 overflow-hidden"
    >
      <div className="max-w-6xl mx-auto px-8 md:px-16 relative z-10">
        {/* Tytuł sekcji – powiększony */}
        <h2 className="text-5xl md:text-6xl font-extrabold font-montserrat uppercase mb-6">
          O nas
        </h2>

        {/* Podtytuł / nazwa (wyśrodkowany) */}
        <h3 className="text-center text-xl md:text-2xl font-montserrat font-semibold mb-4">
          SISI Burger &amp; Pancake
        </h3>

        {/* Opis główny (wyśrodkowany) */}
        <p className="text-center font-montserrat text-sm md:text-base leading-relaxed max-w-3xl mx-auto mb-6">
          Naszą misją jest łączenie pysznych smaków burgerów i pancake’ów w jednym miejscu!
          Staramy się zaskoczyć Was chrupiącym bekonem, aromatycznymi sosami, a także słodkimi
          placuszkami z owocami i czekoladą. Nasza oferta jest ciągle poszerzana o nowe smaki,
          aby każdy mógł znaleźć coś dla siebie.
        </p>

        {/* Sekcja atutów */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-10">
          {/* Atut 1 */}
          <div className="flex flex-col items-center text-center">
            <Image
              src="/icon-1.png"
              alt="Ikona jakości"
              width={60}
              height={60}
              className="mb-4"
            />
            <h4 className="text-lg font-bold mb-2">Świeże składniki</h4>
            <p className="text-sm leading-snug">
              Codziennie dbamy o jakość produktów, by każdy kęs był wyjątkowy.
            </p>
          </div>

          {/* Atut 2 */}
          <div className="flex flex-col items-center text-center">
            <Image
              src="/icon-2.png"
              alt="Ikona rezerwacji"
              width={60}
              height={60}
              className="mb-4"
            />
            <h4 className="text-lg font-bold mb-2">Rezerwacja online</h4>
            <p className="text-sm leading-snug">
              Zamówienie i rezerwacja w kilku klikach. Ciesz się szybką obsługą!
            </p>
          </div>

          {/* Atut 3 */}
          <div className="flex flex-col items-center text-center">
            <Image
              src="/icon-3.png"
              alt="Ikona dostawy"
              width={60}
              height={60}
              className="mb-4"
            />
            <h4 className="text-lg font-bold mb-2">Dostawa lub odbiór</h4>
            <p className="text-sm leading-snug">
              Sam zdecyduj, czy wolisz odwiedzić nas na miejscu, czy zamówić do domu.
            </p>
          </div>

          {/* Atut 4 */}
          <div className="flex flex-col items-center text-center">
            <Image
              src="/icon-4.png"
              alt="Ikona Mięsa"
              width={60}
              height={60}
              className="mb-4"
            />
            <h4 className="text-lg font-bold mb-2">Ręcznie robione Mięso</h4>
            <p className="text-sm leading-snug">
              Wybieramy wołowinę najwyższej jakości i sami formujemy kotlety,
              by dostarczyć wam niesamowity smak mięsa.
            </p>
          </div>
        </div>
      </div>

      {/* Kontener na historię (lewa kolumna) i opis (prawa kolumna) */}
      <div className="max-w-6xl mx-auto px-8 md:px-16 mt-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Lewa kolumna – „mapa”/timeline powstania */}
          <div className="flex flex-col justify-center">
            <h3 className="text-xl md:text-2xl font-bold mb-6">
              Historia Sisi Ciechanów
            </h3>

            {/* Blok 1 */}
            <div className="flex items-center gap-4 mb-6">
              <Image
                src="/foodtruck.png"
                alt="Foodtruck Sisi"
                width={50}
                height={50}
                className="object-contain"
              />
              <div>
                <h4 className="font-bold text-sm">Foodtruck Sisi</h4>
                <p className="text-xs">31 kwietnia 2021r</p>
              </div>
            </div>

            {/* Blok 2 */}
            <div className="flex items-center gap-4 mb-6">
              <Image
                src="/lokal-centrum.png"
                alt="Mały lokal w centrum"
                width={50}
                height={50}
                className="object-contain"
              />
              <div>
                <h4 className="font-bold text-sm">Mały lokal w centrum</h4>
                <p className="text-xs">2 stycznia 2022r</p>
              </div>
            </div>

            {/* Blok 3 */}
            <div className="flex items-center gap-4">
              <Image
                src="/lokal-obrzeza.png"
                alt="Większy lokal"
                width={50}
                height={50}
                className="object-contain"
              />
              <div>
                <h4 className="font-bold text-sm">Większy lokal na obrzeżach miasta</h4>
                <p className="text-xs">26 października 2023r</p>
              </div>
            </div>
          </div>

          {/* Prawa kolumna – tekst */}
          <div className="leading-relaxed text-sm md:text-base">
            <p className="mb-4">
              <strong>Zapraszamy do restauracji Sisi Burger &amp; Pancake</strong>, jedynego miejsca w Ciechanowie, 
              gdzie skosztujesz soczystych burgerów i puszystych, amerykańskich pancake! Znajdujemy się na osiedlu Bloki, 
              co sprawia, że łatwo do nas trafić zarówno mieszkańcom, jak i odwiedzającym miasto.
            </p>
            <p className="mb-4">
              Jeśli szukasz pysznego jedzenia w Ciechanowie, jesteśmy odpowiedzią na Twoje potrzeby. 
              Nasze menu łączy klasykę amerykańskiej kuchni z lokalnymi smakami, a wszystkie dania 
              przygotowujemy z najwyższej jakości składników. Sisi Burger &amp; Pancake to idealne 
              miejsce na rodzinny obiad, spotkanie z przyjaciółmi czy szybki lunch.
            </p>
            <p className="mb-4">
              Odwiedź nas i poczuj wyjątkowy klimat naszej restauracji. Sprawdź, dlaczego nasze burgery 
              i pancake podbijają serca smakoszy z Ciechanowa i okolic. Wpisz w wyszukiwarkę 
              <em> "restauracja Ciechanów", "jedzenie Ciechanów"</em> lub po prostu zajrzyj do nas 
              osobiście. Czekamy na Ciebie z uśmiechem i pysznym jedzeniem!
            </p>
          </div>
        </div>
      </div>

      {/* Sekcja kontaktu/mapki na dole */}
      <div className="mt-16 bg-black text-white py-10 px-8 md:px-16 w-full relative">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Lewa kolumna – Kontakt + „Oceń nas” + QR */}
          <div className="flex flex-col gap-6">
            {/* Kontakt */}
            <div>
              <h3 className="text-xl font-bold mb-2">Gdzie nas znajdziesz?</h3>
              <p className="text-sm mb-4">ul.Spółdzielcza 7, Ciechanów 06-400</p>
              <p className="text-sm mb-4">
                <strong>Godziny otwarcia:</strong>
                <br />
                Pon - Pt: 10:00 - 20:00
                <br />
                Sob - Nd: 11:00 - 22:00
              </p>
              <p className="text-sm mb-4">
                <strong>Telefon:</strong>{" "}
                <a href="tel:123456789" className="underline">
                  123 456 789
                </a>
                <br />
                <strong>Email:</strong>{" "}
                <a href="mailto:kontakt@sisiburger.pl" className="underline">
                  kontakt@sisiburger.pl
                </a>
              </p>
            </div>

            {/* „Oceń nas” z tekstem i kodem QR pod spodem */}
            <div>
              <h4 className="text-lg font-bold mb-2">Oceń nas!</h4>
              <p className="text-sm">
                Zostaw opinię w Google, abyśmy mogli stale ulepszać nasze smaki.
              </p>
              <div className="mt-4">
                {/* Zastąp /qr.png swoim plikiem QR */}
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

        {/* Napis na dole, całkowicie z lewej, mniejsza czcionka */}
        <div className="absolute left-0 bottom-0 ml-2 md:ml-4 mb-4">
          <p className="text-[10px] text-white">
            Stronę oraz system zamówień wykonał: Karol Wyszczelski
          </p>
        </div>
      </div>
    </section>
  );
}
