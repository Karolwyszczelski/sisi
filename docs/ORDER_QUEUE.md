# Kolejka integracji zamówień

Zamówienie, zmiana stanu i odpowiadające im zadania zapisują się w jednej transakcji PostgreSQL. Wywołania z obsługi HTTP skracają czas oczekiwania. Harmonogram wywołuje `GET /api/p24/reconcile` z `Authorization: Bearer …` i przejmuje zadania, które nadal są gotowe do wykonania.

## Konfiguracja przed odbiorem na środowisku testowym

- Zastosuj migracje PR 1–4 przed uruchomieniem nowej wersji aplikacji. Podczas przejścia wszystkie tryby sprzedaży pozostają zamknięte. Starsze wersje wysyłają powiadomienia bez kolejki, więc nie mieszaj ich z nową wersją podczas przyjmowania zamówień.
- P24 wymaga `P24_REPORTS_KEY`, czyli klucza raportów do REST, oraz dotychczasowych identyfikatorów i klucza CRC. W środowisku docelowym sprawdź dostęp hosta do REST zgodnie z konfiguracją konta P24. Lokalny odbiór używa atrap.
- Worker korzysta z kanonicznego adresu aplikacji w `APP_BASE_URL` lub odpowiedniku publicznym, sekretu autoryzacji Dotypos oraz `CRON_SECRET`. Do kolejki maili wymagany jest `RESEND_API_KEY`. SMTP pozostaje dostępne dla istniejących maili spoza obsługi zamówień.
- Migracja planuje uzgodnienie istniejących sesji P24 oczekujących na potwierdzenie. Nie odtwarza historycznych wysyłek do POS ani maili.

## Zadania do wyjaśnienia

Cron zwraca liczby `processed` i `needsReview`. Wynik `needsReview > 0` oznacza niepowodzenie workflow GitHub Actions. Szczegóły można odczytać według klucza zdarzenia i kodu przyczyny w tabeli `order_jobs`. Treść wiadomości i jej adresat nie trafiają do wyniku crona. Udana dostawa usuwa kopię treści i danych kontaktowych z kolejki.

- Rozpoczęcie mutacji u dostawcy jest zapisane przed wywołaniem. Jeśli odpowiedź z rejestracji P24 zaginie, worker sprawdzi sesję i potwierdzi płatność, jeśli jest widoczna. Odczyt po sesji nie zwraca tokena rejestracji. Gdy nie da się odzyskać wyniku dla klienta, zadanie trafia do weryfikacji. Sprawdź sesję u operatora przed podjęciem dalszych działań. Zachowaj znacznik pierwszej próby.
- Po niepewnym wyniku POS worker czeka na potwierdzenie i zapis identyfikatora w zamówieniu. Bez potwierdzenia po 20 minutach zadanie trafia do weryfikacji. Sprawdź zlecenie pod istniejącym identyfikatorem przed jakąkolwiek ponowną realizacją. Wymuszony wydruk pozostaje odrębną akcją personelu.
- Resend dostaje ten sam klucz i treść przy każdym ponowieniu. Automatyczne próby są blokowane po 23 godzinach od pierwszej wysyłki, zanim wygaśnie okno deduplikacji operatora.
- Uzgadnianie płatności korzysta z sesji P24 i sprawdza kwotę oraz walutę. Po siedmiu dniach bez śladu płatności kończy odpytywanie. Późniejszy zweryfikowany callback pozostaje obsługiwany.

Przy wycofaniu wersji wstrzymaj przyjmowanie zamówień i zatrzymaj worker przed uruchomieniem starej ścieżki wysyłki. Zachowaj wpisy kolejki oraz identyfikatory sesji. Odzyskanie wysyłki wymaga uzgodnienia u operatorów wszystkich niejednoznacznych prób.

## Próby lokalne

- `node --test supabase/tests/order_queue_worker.test.cjs`
- `sh supabase/tests/run_order_queue.sh`
