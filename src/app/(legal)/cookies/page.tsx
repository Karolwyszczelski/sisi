import { LEGAL } from "@/config/legal";
import LegalPageLayout from "@/components/legal/LegalPageLayout";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Polityka cookies – SISI Burger & Pancakes",
  description: "Informacje o plikach cookies i podobnych technologiach używanych przez SISI Burger & Pancakes oraz sposobach zarządzania zgodami.",
  alternates: { canonical: "/cookies" },
  robots: { index: true, follow: true },
};

export default function CookiesPage() {
  return (
    <LegalPageLayout title="Polityka cookies" icon="cookies">
      <p className="text-lg md:text-xl text-white/70 !mt-0 mb-8">
        Niniejsza Polityka cookies wyjaśnia, czym są pliki cookies, w jaki sposób je wykorzystujemy 
        oraz jak możesz nimi zarządzać podczas korzystania z serwisu {LEGAL.shortBrand}.
      </p>

      <h2>§1. Czym są cookies?</h2>
      <p>
        Cookies to niewielkie pliki zapisywane na urządzeniu użytkownika przez przeglądarkę. Mogą być odczytywane ponownie
        przez serwis przy kolejnych odwiedzinach. Technologie podobne to m.in. localStorage czy pixel tags.
      </p>

      <h2>§2. Kategorie cookies</h2>
      <div className="grid gap-4 my-6">
        <div className="bg-green-400/10 border border-green-400/20 rounded-xl p-4">
          <h3 className="!text-green-400 !text-base !mt-0 !mb-2 font-semibold">🔒 Niezbędne (strictly necessary)</h3>
          <p className="!text-white/70 !text-sm !m-0">
            Wymagane do prawidłowego działania serwisu (sesja, koszyk, bezpieczeństwo, preferencje zgody). 
            Nie można ich wyłączyć.
          </p>
        </div>
        <div className="bg-blue-400/10 border border-blue-400/20 rounded-xl p-4">
          <h3 className="!text-blue-400 !text-base !mt-0 !mb-2 font-semibold">📊 Analityczne</h3>
          <p className="!text-white/70 !text-sm !m-0">
            Pomagają analizować ruch i działanie serwisu (z wykorzystaniem zanonimizowanych danych, gdy to możliwe).
          </p>
        </div>
        <div className="bg-purple-400/10 border border-purple-400/20 rounded-xl p-4">
          <h3 className="!text-purple-400 !text-base !mt-0 !mb-2 font-semibold">📢 Marketingowe</h3>
          <p className="!text-white/70 !text-sm !m-0">
            Personalizacja treści/ofert oraz pomiar efektywności reklam (aktywowane wyłącznie po wyrażeniu zgody).
          </p>
        </div>
      </div>

      <h2>§3. Baner zgody i zarządzanie</h2>
      <ul>
        <li>Podczas pierwszej wizyty wyświetlamy baner zarządzania zgodą. Możesz zaakceptować wszystkie kategorie, odrzucić nieobowiązkowe lub dopasować wybór.</li>
        <li>Preferencje możesz zmienić w dowolnym momencie (link „Ustawienia cookies" w stopce).</li>
        <li>Brak zgody może ograniczyć funkcjonalności niezwiązane z działaniem podstawowym.</li>
      </ul>

      <h2>§4. Okresy przechowywania</h2>
      <ul>
        <li><strong>Cookies sesyjne</strong> – do końca sesji przeglądarki.</li>
        <li><strong>Cookies trwałe</strong> – zwykle od 1 dnia do 12 miesięcy (szczegółowy czas zależy od dostawcy narzędzia).</li>
      </ul>

      <h2>§5. Dostawcy narzędzi</h2>
      <p>
        W serwisie mogą działać narzędzia zewnętrzne (np. analityczne/marketingowe) oraz komponenty techniczne
        (np. operator płatności, integracje map). Dane mogą być przekazywane dostawcom jako odrębnych administratorów
        lub podmiotów przetwarzających – w zakresie opisanym w <a href="/polityka-prywatnosci">Polityce prywatności</a>.
      </p>

      <h2>§6. Jak kontrolować cookies w przeglądarce?</h2>
      <p>
        Większość przeglądarek pozwala blokować lub usuwać cookies. Instrukcje znajdują się w ustawieniach przeglądarki.
        Zablokowanie cookies niezbędnych może uniemożliwić korzystanie z części funkcji.
      </p>

      <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-xl p-4 my-6">
        <p className="!text-yellow-400/90 !text-sm !m-0">
          <strong>💡 Wskazówka:</strong> Aby zmienić ustawienia cookies, szukaj w menu przeglądarki opcji 
          „Prywatność", „Bezpieczeństwo" lub „Pliki cookie".
        </p>
      </div>

      <h2>§7. Zmiany w Polityce</h2>
      <p>
        Zastrzegamy prawo do aktualizacji Polityki cookies, m.in. w razie zmian technologicznych lub prawnych.
        Obowiązuje wersja opublikowana w serwisie.
      </p>
    </LegalPageLayout>
  );
}
