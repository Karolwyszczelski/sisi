import { LEGAL } from "./legal";

export const ORDER_TERMS_VERSION = "2026-11-25";

export const ORDER_TERMS_COMPANY = `Sprzedawca: ${LEGAL.legalName}, NIP ${LEGAL.nip}, REGON ${LEGAL.regon}.
Adres rejestrowy: ${LEGAL.registeredAddress}.
Lokal: ${LEGAL.restaurantAddress}.
Kontakt: ${LEGAL.email}, ${LEGAL.phone}.`;

export const ORDER_TERMS_BODY = `Regulamin określa zasady korzystania z serwisu zamówień online ${LEGAL.shortBrand} oraz warunki zawierania i realizacji umów sprzedaży na odległość.

§1. Definicje
• Serwis – strona/aplikacja internetowa umożliwiająca składanie zamówień.
• Sprzedawca/Operator – ${LEGAL.legalName}.
• Klient – konsument lub przedsiębiorca składający zamówienie.
• Zamówienie – oświadczenie woli Klienta, zmierzające do zawarcia umowy sprzedaży.
• Umowa – umowa sprzedaży posiłków/napojów zawierana na odległość za pośrednictwem Serwisu.
• Płatność online – obsługiwana przez zewnętrznego operatora płatności (np. Przelewy24/PayPro S.A.).

§2. Postanowienia ogólne
• Serwis działa zgodnie z prawem polskim i UE (m.in. UŚUDE, ustawa o prawach konsumenta, RODO).
• Minimalne wymagania techniczne: przeglądarka z włączonym JavaScriptem i cookies, aktywne połączenie internetowe.
• Zakazuje się dostarczania treści bezprawnych oraz podejmowania działań naruszających bezpieczeństwo Serwisu.

§3. Konto i usługi elektroniczne
• Konto w Serwisie jest opcjonalne. Zamówienie można złożyć także bez logowania.
• Usługi elektroniczne: formularz zamówienia, rejestracja/logowanie, newsletter (za zgodą).
• Umowa o świadczenie usług elektronicznych jest zawierana z chwilą skorzystania z funkcji Serwisu i rozwiązywana z chwilą ich opuszczenia lub usunięcia Konta.
• Użytkownik może w każdym czasie rozwiązać umowę o świadczenie usług elektronicznych (np. przez usunięcie Konta lub kontakt na ${LEGAL.email}).

§4. Składanie zamówień i zawarcie umowy
• Klient wybiera produkty, opcję odbioru (na miejscu/odbiór osobisty/dostawa), podaje dane kontaktowe i wybiera metodę płatności.
• Po złożeniu zamówienia Klient otrzymuje potwierdzenie (e-mail) oraz – po akceptacji przez obsługę – informację o czasie realizacji.
• Umowa zostaje zawarta z chwilą akceptacji zamówienia przez obsługę (status „accepted”).
• W przypadku płatności online realizacja rozpoczyna się po potwierdzeniu przez operatora płatności.

§5. Ceny, płatności i paragony/faktury
• Ceny wyświetlane przy produktach są cenami brutto (zawierają podatki). Mogą zawierać opłaty dodatkowe (np. opakowanie, dostawa) – wskazywane w podsumowaniu.
• Dostępne metody płatności: gotówka, terminal, płatność online (operator płatności – według informacji w koszyku).
• Po sprzedaży wydawany jest paragon fiskalny w lokalu lub doręczany z zamówieniem; na życzenie wystawiana jest faktura (dane należy podać przed finalizacją).

§6. Dostawa / odbiór
• Dostawy realizowane są w wyznaczonym obszarze. Koszt i szacowany czas dostawy prezentowane są w Serwisie.
• Klient zobowiązany jest podać prawidłowy adres oraz numer telefonu. Brak kontaktu lub błędny adres mogą skutkować anulowaniem.
• W przypadku znacznego obłożenia czas realizacji może się wydłużyć; informujemy o tym niezwłocznie.

§7. Zasady jakości i alergeny
• Potrawy przygotowywane są na bieżąco. Informujemy, że w kuchni mogą być obecne alergeny (np. gluten, orzechy, mleko, jaja).
• W razie wątpliwości co do składników prosimy o kontakt przed złożeniem zamówienia.

§8. Prawo odstąpienia (żywność)
 Zgodnie z art. 38 pkt 4 ustawy o prawach konsumenta prawo odstąpienia od umowy zawartej na odległość nie przysługuje w odniesieniu do rzeczy ulegających szybkiemu zepsuciu lub mających krótki termin przydatności do użycia. Zamówienia gastronomiczne co do zasady nie podlegają odstąpieniu po przygotowaniu.

§9. Reklamacje
• Reklamacje dotyczące zamówień można składać na adres ${LEGAL.email} lub telefonicznie ${LEGAL.phone}.
• W zgłoszeniu podaj numer zamówienia, opis zastrzeżeń i – jeśli to możliwe – dokumentację (np. zdjęcia).
• Odpowiadamy w terminie do 14 dni kalendarzowych. W razie uznania reklamacji – naprawa/wymiana, ponowna realizacja, obniżenie ceny lub zwrot środków (w przypadku płatności online – tą samą drogą).

§10. Kody rabatowe i promocje
• Kody rabatowe mają określony czas ważności, minimalną wartość zamówienia lub wyłączenia asortymentowe – zgodnie z komunikatem przy wydaniu kodu.
• Nie łączą się, o ile regulamin promocji nie stanowi inaczej.

§11. Odpowiedzialność i zakaz nadużyć
• Zakazane jest nadużywanie Serwisu, w tym składanie fikcyjnych zamówień, używanie cudzych danych, naruszanie praw osób trzecich.
• Operator zastrzega prawo do wstrzymania lub anulowania zamówienia w razie uzasadnionych wątpliwości co do prawidłowości danych lub płatności.

§12. Dane osobowe
 Administratorem danych jest ${LEGAL.legalName}. Zasady przetwarzania opisuje Polityka prywatności. Pliki cookies – zgodnie z Polityką cookies.

§13. Pozasądowe rozwiązywanie sporów
 Konsument może skorzystać z pomocy miejskiego lub powiatowego rzecznika konsumentów oraz z pozasądowego rozwiązywania sporów przy Inspekcji Handlowej. Właściwe jest prawo polskie i sądy powszechne.

§14. Postanowienia końcowe
• Regulamin jest dostępny nieodpłatnie w Serwisie i może być pobrany/utrwalony przez Użytkownika.
• Zmiany Regulaminu wchodzą w życie z dniem publikacji i obowiązują na przyszłość; do zamówień złożonych wcześniej stosuje się wersję obowiązującą w dacie złożenia.`;

export const ORDER_TERMS_TEXT = `Regulamin SISI — wersja ${ORDER_TERMS_VERSION}\n\n${ORDER_TERMS_COMPANY}\n\n${ORDER_TERMS_BODY}`;
