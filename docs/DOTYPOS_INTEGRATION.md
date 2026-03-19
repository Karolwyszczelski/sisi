# Dotypos API v2 Integration (2026.10.0)

## Przegląd

Ta integracja umożliwia połączenie strony SISI Burger z systemem kasowym Dotypos (Dotykačka). Główne funkcje:

- 🔄 **Synchronizacja produktów** - pobieranie menu z Dotypos do lokalnej bazy
- 📤 **Wysyłanie zamówień** - automatyczne tworzenie zamówień w kasie POS
- 🧾 **Wystawianie paragonów** - automatyczne generowanie paragonów
- 💳 **Oznaczanie płatności** - oznaczanie zamówień jako opłaconych
- 🔔 **Webhooks** - odbieranie powiadomień o zmianach z POS
- 🏥 **POS Health Check** - sprawdzanie czy kasa POS jest online
- 🔑 **Idempotency** - ochrona przed duplikatami zamówień

## Struktura plików

```
src/
├── lib/
│   ├── dotypos.ts              # Główny klient API v2 (2026.10.0)
│   └── dotykacka.ts            # ⚠️ DEPRECATED - stary klient API v1
├── types/
│   └── dotypos.ts              # Typy TypeScript
├── app/api/dotypos/
│   ├── callback/route.ts       # OAuth callback
│   ├── connector-url/route.ts  # Generowanie danych połączenia (POST form)
│   ├── test-connection/route.ts # Test połączenia + POS hello
│   ├── sync-products/route.ts  # Synchronizacja produktów
│   ├── send-order/route.ts     # Wysyłanie zamówień (z idempotency)
│   └── webhook/route.ts        # Webhook receiver (POS + entity changes)
└── components/admin/settings/
    └── IntegrationsForm.tsx     # UI panelu admina

supabase/migrations/
└── create_dotypos_tables.sql   # Migracje bazy danych
```

## Konfiguracja

### 1. Zmienne środowiskowe

Dodaj do `.env.local`:

```env
# Dotypos API v2
DOTYPOS_CLIENT_ID=your_client_id
DOTYPOS_CLIENT_SECRET=your_client_secret

# Opcjonalnie - konkretny oddział
DOTYPOS_BRANCH_ID=12345

# ID metody płatności dla zamówień online (WYMAGANE dla create-issue-pay!)
# Pobierz z panelu Dotypos admin lub z GET /v2/clouds/{cloudId}/payment-methods
DOTYPOS_PAYMENT_METHOD_ID=123

# Tryb webhook (domyślnie sync - API czeka do 21s na odpowiedź POS)
# Ustaw true dla trybu async (odpowiedź via webhook, brak rate limitu)
# DOTYPOS_USE_ASYNC_WEBHOOK=false
```

### 2. Migracja bazy danych

Uruchom migrację w Supabase SQL Editor:

```bash
# Skopiuj zawartość pliku:
supabase/migrations/create_dotypos_tables.sql

# Lub użyj CLI:
supabase db push
```

### 3. Połączenie z Dotypos

1. Przejdź do: `/admin/settings`
2. Kliknij "Połącz z Dotypos"
3. Zaloguj się do swojego konta Dotypos
4. Autoryzuj aplikację
5. Gotowe!

## Użycie API

### Synchronizacja produktów

```bash
# GET - synchronizuj produkty
curl https://sisiciechanow.pl/api/dotypos/sync-products

# Odpowiedź:
{
  "success": true,
  "synced": {
    "products": 45,
    "categories": 8
  },
  "total": 45,
  "duration": 1234
}
```

### Wysyłanie zamówienia

```bash
# POST - wyślij zamówienie do POS
curl -X POST https://sisiciechanow.pl/api/dotypos/send-order \
  -H "Content-Type: application/json" \
  -d '{"orderId": "uuid-zamowienia"}'

# Odpowiedź:
{
  "success": true,
  "orderId": "uuid-zamowienia",
  "dotypos": {
    "orderId": 12345,
    "receiptId": 67890,
    "status": "sent",
    "code": 0
  },
  "itemsCount": 3
}
```

### Test połączenia (+ POS Hello)

```bash
# GET - sprawdź status połączenia i POS
curl https://sisiciechanow.pl/api/dotypos/test-connection

# Odpowiedź:
{
  "connected": true,
  "cloudId": "123456",
  "branches": [
    { "id": 1, "name": "SISI Burger Ciechanów" }
  ],
  "posOnline": true,
  "posDevice": "DotyposDevice-1"
}
```

### Webhooks

Webhook endpoint: `POST /api/dotypos/webhook`

Obsługuje dwa typy webhooków:

1. **POS Action response** - odpowiedź z kasy POS po przetworzeniu zamówienia
2. **Entity change** - powiadomienia o zmianach (ORDERBEAN, PRODUCT, STOCKLOG, etc.)

```bash
# GET - status webhook endpoint
curl https://sisiciechanow.pl/api/dotypos/webhook
```

## Przepływ OAuth (Connector v2 - POST)

> **Uwaga:** Od stycznia 2026 metoda GET jest deprecated. Używaj POST form submission.

```
┌─────────────┐     ┌─────────────────┐     ┌───────────────┐
│  Admin UI   │────▶│ /api/dotypos/   │────▶│  Dotypos      │
│  Settings   │     │ connector-url   │     │  OAuth Page   │
└─────────────┘     │ (returns form   │     │  (POST form)  │
                    │  data for POST) │     └───────────────┘
                    └─────────────────┘             │
                                                    ▼
┌─────────────┐     ┌─────────────────┐     ┌───────────────┐
│  Connected! │◀────│ /api/dotypos/   │◀────│  Callback     │
│  UI Update  │     │ callback        │     │  (redirect)   │
└─────────────┘     └─────────────────┘     └───────────────┘
```

### Token Exchange (2026 API)

Nowy format wymiany tokenu:
```
POST https://api.dotykacka.cz/v2/signin/token
Authorization: User $refreshToken
Body: { "_cloudId": "cloudId" }
Response: { "accessToken": "eyJ..." }
```

## Mapowanie produktów

System mapuje produkty z zamówienia do produktów POS na podstawie nazwy:

1. **Dokładne dopasowanie** - nazwa produktu = nazwa w POS
2. **Zawiera** - nazwa produktu zawiera się w nazwie POS
3. **Częściowe słowa** - przynajmniej jedno słowo (3+ znaki) pasuje

Jeśli produkt nie zostanie zmapowany, pojawi się ostrzeżenie w notatce zamówienia.

## Tabele w bazie danych

### pos_products
```sql
pos_id     BIGINT PRIMARY KEY  -- ID produktu w Dotypos
name       TEXT                -- Nazwa produktu
price      DECIMAL             -- Cena brutto
barcode    TEXT                -- Kod kreskowy
category_id BIGINT             -- ID kategorii
deleted    BOOLEAN             -- Czy usunięty
synced_at  TIMESTAMPTZ         -- Data synchronizacji
```

### orders (rozszerzenie)
```sql
dotypos_order_id            BIGINT      -- ID zamówienia w Dotypos
dotypos_receipt_id          BIGINT      -- ID paragonu
dotypos_sent_at             TIMESTAMPTZ -- Kiedy wysłano
dotypos_error               TEXT        -- Błąd (jeśli wystąpił)
dotypos_status              TEXT        -- Status: sent, confirmed, pos_error
dotypos_webhook_received_at TIMESTAMPTZ -- Kiedy odebrano webhook
dotypos_pos_response_code   INT         -- Kod odpowiedzi POS (0 = OK)
```

### dotypos_webhook_logs (opcjonalnie)
```sql
id          SERIAL PRIMARY KEY
type        TEXT             -- Typ: pos-action-response, ORDERBEAN, PRODUCT, etc.
payload     JSONB            -- Pełny payload
received_at TIMESTAMPTZ      -- Data odbioru
```

## Rozwiązywanie problemów

### "Dotypos not connected"
→ Przejdź do `/admin/settings` i połącz się z Dotypos

### "No POS products available"
→ Uruchom synchronizację: `GET /api/dotypos/sync-products`

### "Token exchange failed"
→ Sprawdź czy `DOTYPOS_CLIENT_ID` i `DOTYPOS_CLIENT_SECRET` są poprawne
→ Nowy format tokenu (2026): Authorization: User $refreshToken + body: { "_cloudId": "..." }

### Produkty nie są mapowane
→ Sprawdź czy nazwy produktów w Dotypos odpowiadają nazwom na stronie
→ Uruchom synchronizację produktów

### POS offline / timeout
→ Użyj `posHello()` do sprawdzenia czy kasa jest online
→ Test: `GET /api/dotypos/test-connection` (pole `posOnline`)

### Duplikaty zamówień
→ System automatycznie generuje `idempotency-key` dla każdego zamówienia
→ Klucz to UUID zamówienia z Supabase - bezpieczne jest ponawianie wysyłki

## Dostępne POS Actions (Dotypos 2026)

| Akcja | Opis | Min. wersja |
|-------|------|-------------|
| `order/hello` | Health check POS | 1.239.8 |
| `order/create` | Utwórz zamówienie | 1.234 |
| `order/create-issue` | Utwórz + paragon | 1.234 |
| `order/create-issue-pay` | Utwórz + paragon + zapłać | 1.234 |
| `order/update` | Aktualizuj zamówienie | 1.234 |
| `order/add-item` | Dodaj pozycje | 1.234 |
| `order/issue` | Wystaw paragon | 1.234 |
| `order/pay` | Zapłać za zamówienie | 1.234 |
| `order/cancel` | Anuluj puste zamówienie | 1.243 |
| `order/list` | Lista otwartych zamówień | 1.235 |
| `order/split` | Podziel zamówienie | 1.234 |
| `order/set-item-takeaway` | Ustaw takeaway per item | 1.237 |

## API Dotypos - Dokumentacja

- [Dotypos API v2 Docs](https://docs.api.dotypos.com/)
- [POS Actions](https://docs.api.dotypos.com/pos-actions/pos-actions/)
- [Authorization](https://docs.api.dotypos.com/authorization/authorization/)
- [Webhooks](https://docs.api.dotypos.com/webhooks/)
- [Breaking Changes](https://docs.api.dotypos.com/breaking-changes/breaking-changes/)
- [Release Notes](https://docs.api.dotypos.com/release-notes/)

## Kolejne kroki

- [x] Webhook do odbierania statusów zamówień
- [x] POS Hello health check
- [x] Idempotency key dla bezpiecznego retry
- [ ] Automatyczna synchronizacja produktów (cron)
- [ ] Panel mapowania produktów
- [ ] Historia wysłanych zamówień
- [ ] Rejestracja webhooków entity change (ORDERBEAN, PRODUCT)
- [ ] Obsługa customizations / modyfikatorów (Dotypos 2.17, kwiecień 2026)
