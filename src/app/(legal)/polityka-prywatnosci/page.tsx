import { LEGAL } from "@/config/legal";
import LegalPageLayout from "@/components/legal/LegalPageLayout";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Polityka prywatności – SISI Burger & Pancakes",
  description: "Zasady przetwarzania danych osobowych w SISI Burger & Pancakes: administrator, cele, podstawy prawne i prawa użytkownika.",
  alternates: { canonical: "/polityka-prywatnosci" },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <LegalPageLayout title="Polityka prywatności" icon="privacy">
      <p className="text-lg md:text-xl text-white/70 !mt-0 mb-8">
        Niniejsza Polityka prywatności określa zasady przetwarzania i ochrony danych osobowych 
        przekazanych przez Użytkowników w związku z korzystaniem z serwisu {LEGAL.shortBrand}.
      </p>

      <h2>§1. Podstawy prawne i cele przetwarzania</h2>
      <ul>
        <li><strong>Realizacja zamówień</strong> – art. 6 ust. 1 lit. b RODO (umowa); dane: imię, telefon, e-mail, adres dostawy, treść zamówienia.</li>
        <li><strong>Rozliczenia i podatki</strong> – art. 6 ust. 1 lit. c RODO (obowiązek prawny); dane na dokumentach księgowych, terminy przechowywania wynikają z przepisów.</li>
        <li><strong>Kontakt, bezpieczeństwo, dochodzenie roszczeń</strong> – art. 6 ust. 1 lit. f RODO (prawnie uzasadniony interes).</li>
        <li><strong>Marketing bezpośredni/newsletter</strong> – art. 6 ust. 1 lit. a RODO (zgoda); możliwe do odwołania w każdym czasie.</li>
      </ul>

      <h2>§2. Kategorie danych</h2>
      <ul>
        <li>Dane identyfikacyjne i kontaktowe (imię, telefon, e-mail); dane adresowe (ulica, numer, kod, miejscowość).</li>
        <li>Dane transakcyjne (pozycje zamówienia, cena, status płatności). <strong>Uwaga:</strong> nie przetwarzamy w Serwisie pełnych danych kart płatniczych – obsługuje je operator płatności.</li>
        <li>Dane techniczne (logi serwera, identyfikatory cookies, adres IP, dane urządzenia) – dla bezpieczeństwa i statystyki.</li>
      </ul>

      <h2>§3. Odbiorcy danych</h2>
      <ul>
        <li>Dostawcy hostingu/IT, poczty e-mail i SMS (w zakresie obsługi notyfikacji).</li>
        <li>Supabase – backend i uwierzytelnianie (hosting danych w UE lub przy odpowiednich zabezpieczeniach).</li>
        <li>Operator płatności (np. PayPro S.A. – Przelewy24) – w zakresie realizacji płatności.</li>
        <li>Biuro rachunkowe, doradcy prawni – w zakresie niezbędnym do rozliczeń/obsługi prawnej.</li>
        <li>Dostawcy narzędzi analitycznych i cookies – zgodnie z <a href="/cookies">Polityką cookies</a>.</li>
      </ul>

      <h2>§4. Przekazywanie poza EOG</h2>
      <p>
        Jeżeli konkretny dostawca przetwarza dane poza EOG, zapewniamy podstawę legalności (np. standardowe klauzule umowne)
        oraz dodatkowe środki bezpieczeństwa (szyfrowanie, minimalizacja danych).
      </p>

      <h2>§5. Okresy przechowywania</h2>
      <ul>
        <li>Dane zamówień i rozliczeń – przez okres przewidziany przepisami podatkowymi i rachunkowymi (co do zasady 5 lat podatkowych).</li>
        <li>Korespondencja i logi techniczne – do 12 miesięcy, chyba że dłuższy okres jest niezbędny do ustalenia/doch. roszczeń.</li>
        <li>Konto użytkownika – do czasu usunięcia; newsletter/marketing – do odwołania zgody.</li>
      </ul>

      <h2>§6. Prawa osób, których dane dotyczą</h2>
      <div className="bg-blue-400/10 border border-blue-400/20 rounded-xl p-4 mb-4">
        <p className="text-sm text-blue-400/90 !m-0">
          Przysługuje Ci prawo do: dostępu do danych, ich sprostowania, usunięcia, ograniczenia przetwarzania, 
          przenoszenia danych oraz sprzeciwu wobec przetwarzania.
        </p>
      </div>
      <ul>
        <li>Dostępu do danych, ich sprostowania, usunięcia („prawo do bycia zapomnianym"), ograniczenia przetwarzania, przenoszenia danych.</li>
        <li>Sprzeciwu wobec przetwarzania (w tym marketingu bezpośredniego).</li>
        <li>Wniesienia skargi do Prezesa UODO (ul. Stawki 2, 00-193 Warszawa, <a href="https://uodo.gov.pl" target="_blank" rel="noopener noreferrer">uodo.gov.pl</a>).</li>
      </ul>

      <h2>§7. Dobrowolność podania danych</h2>
      <p>
        Podanie danych jest dobrowolne, ale niezbędne do realizacji zamówienia. W zakresie marketingu – dobrowolne i
        zależne od zgody, którą można w każdej chwili wycofać (bez wpływu na zgodność wcześniejszego przetwarzania).
      </p>

      <h2>§8. Zautomatyzowane podejmowanie decyzji</h2>
      <p>
        Nie podejmujemy wobec Ciebie decyzji wyłącznie w oparciu o zautomatyzowane przetwarzanie, w tym profilowanie,
        wywołujące skutki prawne lub w podobny sposób istotnie na Ciebie wpływające.
      </p>

      <h2>§9. Cookies i podobne technologie</h2>
      <p>
        Szczegóły wykorzystania cookies (rodzaje, cele, okresy) i mechanizmu zgody opisuje{" "}
        <a href="/cookies">Polityka cookies</a>. Baner zgody pozwala zaakceptować lub odrzucić kategorie nieobowiązkowe.
      </p>

      <h2>§10. Kontakt w sprawach danych</h2>
      <p>
        Wszelkie żądania i pytania dotyczące danych osobowych prosimy kierować na:{" "}
        <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>.
      </p>
    </LegalPageLayout>
  );
}
