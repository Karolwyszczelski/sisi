# Audyt systemu zamówień SISI i plan napraw

Data audytu: 2026-07-18  
Zakres: kod aplikacji, migracje, konfiguracja, lokalne logi, przepływ zamówień, P24, Dotypos, panel, dostawa i powiadomienia.  
Ograniczenia: podczas audytu nie odpytywano produkcyjnej bazy, P24 ani Dotypos.

## 1. Architektura

- Next.js 15.5.9, React 19 i TypeScript.
- Next.js App Router oraz Route Handlers.
- Supabase: PostgreSQL, Auth, Realtime, Storage i RLS.
- Zustand jako magazyn koszyka.
- Przelewy24 API v3.2.
- Dotypos API/POS.
- Google Maps/Distance Matrix do wyznaczania odległości dostawy.
- Resend lub SMTP dla e-maili.
- Web Push z VAPID.
- Cloudflare Turnstile.
- Twilio jest obecne w kodzie, ale nie jest podłączone do aktualnego przepływu zamówienia.

## 2. Główne elementy systemu

- Koszyk: `src/store/cartStore.ts`
- Checkout: `src/components/menu/CheckoutModal.tsx`
- Tworzenie zamówienia: `src/app/api/orders/create/route.ts`
- Rejestracja płatności P24: `src/app/api/payments/create-transaction/route.ts`
- Callback P24: `src/app/api/p24/callback/route.ts`
- Alternatywny webhook P24: `src/app/api/payments/webhook/route.ts`
- Rekonsyliacja P24: `src/app/api/p24/reconcile/route.ts`
- Wysyłka do POS: `src/app/api/dotypos/send-order/route.ts`
- Webhook Dotypos: `src/app/api/dotypos/webhook/route.ts`
- Aktualizacja zamówienia przez panel: `src/app/api/orders/[orderId]/route.ts`
- Panel operacyjny: `src/app/admin/pickup-order/page.tsx`
- E-mail: `src/lib/mailer.ts`
- Web Push: `src/lib/pushServer.ts`
- Autoryzacja: `middleware.ts`, `src/lib/serverAuth.ts`
- RLS: `supabase/migrations/fix_security_advisor_issues.sql`

## 3. Przepływ zamówienia

```text
menu → koszyk → checkout → Turnstile → POST /api/orders/create
→ walidacja godzin i metody realizacji
→ przeliczenie dodatków, opakowania i dostawy
→ orders → discount_redemptions → order_items
```

Gotówka lub terminal:

```text
placed → Web Push → Dotypos → panel → accepted → completed
```

Płatność online:

```text
placed + payment_status=pending
→ rejestracja P24 → przekierowanie klienta
→ callback + trnVerify → payment_status=paid
→ Web Push → Dotypos → accepted → completed
```

Statusy zamówień znalezione w kodzie: `pending`, `new`, `placed`, `accepted`, `completed`, `cancelled`.

Statusy płatności znalezione w kodzie: `pending`, `paid`, `failed` oraz `null` dla płatności poza P24.

Statusy Dotypos: `sent`, `confirmed`, `pos_error` oraz wartości zwracane przez POS.

Nie ma centralnej maszyny stanów ani potwierdzonego procesu zwrotów/refundów.

## 4. Rejestr ryzyk

### P0 — sekrety produkcyjne śledzone przez Git

Pliki `.env.local` i `supabase/dane` są śledzone przez Git i zawierają dane dostępowe. Wszystkie znajdujące się tam sekrety należy uznać za skompromitowane.

Działania:

1. Ograniczyć dostęp do repozytorium.
2. Zachować materiał potrzebny do analizy incydentu.
3. Rotować Supabase service role, a następnie P24, Dotypos, pocztę, Twilio, Redis/KV, VAPID, Turnstile, Google Maps, sekrety linków i CRON.
4. Po rotacji usunąć pliki z indeksu Git.
5. Oczyścić historię za pomocą `git-filter-repo` lub BFG.
6. Skoordynować force-push i ponowne klonowanie repozytorium.

Rotacja `ORDER_LINK_SECRET` unieważni stare linki śledzenia i wymaga decyzji operacyjnej.

### P0 — dane klientów w historii Git

Śledzone logi zawierają nazwiska, adresy, telefony i e-maile klientów.

Działania:

1. Ograniczyć dostęp do logów i repozytorium.
2. Nie usuwać dowodów przed oceną incydentu.
3. Ocenić obowiązki wynikające z RODO.
4. Usunąć PII z bieżącego repozytorium i historii po zakończeniu analizy.
5. Wprowadzić redakcję danych w loggerze.

### P0 — cena produktu pochodzi z payloadu klienta

Backend przelicza sumę, ale bazową cenę pobiera z `item.price`/`unit_price` przesłanego przez klienta. Możliwe są również pozycje bez poprawnego `product_id` i nieprawidłowe ilości.

Działania:

1. Wymagać poprawnego `product_id`.
2. Pobierać z bazy cenę, dostępność, kategorię i konfigurację produktu.
3. Odrzucać nieistniejące lub wyłączone produkty.
4. Walidować ilość jako dodatnią liczbę całkowitą z limitem.
5. Walidować dodatki względem produktu.
6. Liczyć kwoty w groszach lub bezpiecznym typie dziesiętnym.
7. Wyłącznie wynik serwera zapisywać i przekazywać do P24.

### P0/P1 — niezabezpieczona integracja Dotypos

- Endpoint wysyłki do POS nie wymaga sesji i obsługuje `force=true`.
- Webhook Dotypos nie weryfikuje podpisu ani sekretu.
- Callback OAuth zapisuje token bez potwierdzenia sesji administratora.
- OAuth `state` jest generowany, ale nie jest przechowywany i weryfikowany.
- Connector udostępnia szeroki zakres `scope="*"` bez autoryzacji.

Działania:

1. Zabezpieczyć wysyłkę podpisem wewnętrznym lub uwierzytelnieniem serwer-serwer.
2. Udostępnić `force=true` wyłącznie administratorowi i rejestrować reprint.
3. Weryfikować webhook Dotypos.
4. Trwale zapisywać i jednorazowo zużywać OAuth `state`.
5. Ograniczyć connector i callback do administratora.
6. Dodać trwałą idempotencję `external-id`.

### P1 — brak idempotencji

Frontend wysyła `X-Idempotency-Key`, ale endpoint tworzenia zamówienia go nie wykorzystuje. Callback, refresh, reconcile i ręczna aktualizacja mogą ponownie uruchomić push lub wysyłkę do POS.

Działania:

1. Dodać `idempotency_key` z unikalnym indeksem do `orders`.
2. Przenieść zapis zamówienia, pozycji i rabatu do jednej transakcji/RPC.
3. Dodać tabelę outbox/zdarzeń.
4. Deduplikować osobno `payment_paid`, e-mail, push i wysyłkę do POS.
5. Uruchamiać operacje płatnego zamówienia tylko dla przejścia `pending → paid`.

### P1 — brak kontroli przejść statusów i płatności

Ogólny PATCH panelu pozwala zmieniać status, `payment_status`, metodę płatności, cenę, pozycje i dane klienta. Pracownik może ustawić `paid` bez potwierdzenia operatora.

Działania:

1. Wprowadzić centralną maszynę stanów.
2. Walidować dozwolone przejścia po stronie serwera.
3. Usunąć `payment_status` i `total_price` z ogólnego PATCH.
4. Utworzyć osobną, audytowaną procedurę korekty administracyjnej.
5. Zostawić jeden kanoniczny callback P24.
6. Porównywać z DB session ID, kwotę, walutę i merchant ID.

### P1 — zapis nie jest transakcyjny

`orders`, `discount_redemptions` i `order_items` są zapisywane oddzielnie. Błąd pozycji nie cofa zamówienia. Limity kuponów są sprawdzane przed insertem, bez wspólnej blokady/transakcji.

Działania:

1. Wprowadzić transakcyjne RPC tworzące kompletne zamówienie.
2. Egzekwować limity rabatów przez constraint lub atomową funkcję DB.
3. Nie przyjmować zamówienia, jeśli nie zapisano wszystkich pozycji.

### P1 — zależności i pipeline jakości

Audyt zależności wykazał 14 podatności produkcyjnych: 1 krytyczną, 6 wysokich, 5 średnich i 2 niskie. Build ignoruje błędy TypeScript i ESLint. Brakuje testów oraz CI.

Działania:

1. Odtworzyć `node_modules` przez czystą instalację po zabezpieczeniu sekretów.
2. Aktualizować zależności partiami i testować regresje.
3. Usunąć `ignoreBuildErrors` i `ignoreDuringBuilds` po uporządkowaniu błędów.
4. Dodać CI: lint, typecheck, testy i build.

### P2 — dostawa

Przy awarii Google Distance Matrix backend używa odległości po prostej, co może wybrać zbyt tanią strefę.

Działania:

1. Rozróżniać brak trasy, limit API i awarię integracji.
2. Ustalić bezpieczną politykę fallbacku.
3. Monitorować różnice odległości i kosztów.

### P2 — powiadomienia i obserwowalność

Brakuje trwałej kolejki, deduplikacji i ponowień e-mail/push. Historyczne logi zapisywały całe rekordy zamówień.

Działania:

1. Wysyłać powiadomienia z outboxa.
2. Zapisywać identyfikator zdarzenia i wynik próby.
3. Nie logować nazwisk, adresów, telefonów, e-maili, tokenów ani sekretów.
4. Dodać alerty dla błędów P24, Dotypos, niewysłanych wiadomości i braku nowych zamówień.

## 5. Kolejność realizacji

1. Rotacja sekretów i obsługa incydentu PII.
2. Serwerowe ceny produktów oraz walidacja koszyka.
3. Zabezpieczenie Dotypos i endpointów integracyjnych.
4. Idempotencja zamówień, płatności i POS.
5. Maszyna stanów i blokada ręcznego `paid`.
6. Aktualizacja zależności oraz przywrócenie typecheck/build/CI.
7. Transakcyjny system rabatów i outbox powiadomień.
8. Monitoring rozbieżności P24–orders–Dotypos.

## 6. Minimalny zestaw testów regresyjnych

- Lokal, odbiór i dostawa.
- Burger Miesiąca z dynamiczną nazwą mapowany do ogólnego produktu Dotypos.
- Zmanipulowana cena, nazwa i `product_id`.
- Ilość 0, ujemna, ułamkowa i bardzo duża.
- Nieaktywny produkt lub dodatek.
- Adres poza strefą i awaria Google Maps.
- Darmowa dostawa i minimum strefy.
- Równoległe użycie ostatniego kuponu.
- Dwukrotne żądanie z tym samym `Idempotency-Key`.
- Utrata odpowiedzi po zapisie zamówienia.
- Podwójny callback P24.
- Callback z niezgodną kwotą lub walutą.
- Refresh/reconcile po wcześniejszym webhooku.
- Przerwana lub wygasła płatność.
- Ponowna wysyłka Dotypos i niedostępny POS.
- Niedozwolone przejścia statusów.
- Próba ręcznego ustawienia `paid`.
- Role admin, employee, client i anon.
- Błędy e-mail i Web Push.

## 7. Historia wdrożonych napraw

### 2026-07-18 — mapowanie Burgera Miesiąca

Przyczyna: specjalny komponent dodawał do koszyka dynamiczną nazwę bez `product_id`, przez co istniejący override `products.id=12 → Dotypos Burger Miesiąca` nie był używany.

Zmiana:

- Burger Miesiąca otrzymuje stałe `product_id=12`.
- `product_id` jest zachowywane w koszyku i znormalizowanym payloadzie zamówienia.
- Nazwa widoczna klientowi nadal może zawierać aktualną nazwę burgera.
- Dotypos korzysta z istniejącego jawnego mapowania do ogólnego produktu „Burger Miesiąca”.
- Starsze zamówienia bez `product_id` są obsługiwane przez jawny alias nazwy „Burger Miesiąca – …”.
