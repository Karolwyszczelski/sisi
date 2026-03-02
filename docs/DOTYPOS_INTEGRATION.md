# Dotypos API v2 Integration

## Przegląd

Ta integracja umożliwia połączenie strony SISI Burger z systemem kasowym Dotypos (Dotykačka). Główne funkcje:

- 🔄 **Synchronizacja produktów** - pobieranie menu z Dotypos do lokalnej bazy
- 📤 **Wysyłanie zamówień** - automatyczne tworzenie zamówień w kasie POS
- 🧾 **Wystawianie paragonów** - automatyczne generowanie paragonów
- 💳 **Oznaczanie płatności** - oznaczanie zamówień jako opłaconych

## Struktura plików

```
src/
├── lib/
│   └── dotypos.ts              # Główny klient API v2
├── types/
│   └── dotypos.ts              # Typy TypeScript
├── app/api/dotypos/
│   ├── callback/route.ts       # OAuth callback
│   ├── connector-url/route.ts  # Generowanie URL połączenia
│   ├── test-connection/route.ts # Test połączenia
│   ├── sync-products/route.ts  # Synchronizacja produktów
│   └── send-order/route.ts     # Wysyłanie zamówień
└── components/admin/settings/
    └── IntegrationsForm.tsx    # UI panelu admina

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
    "status": "ok"
  },
  "itemsCount": 3
}
```

### Test połączenia

```bash
# GET - sprawdź status połączenia
curl https://sisiciechanow.pl/api/dotypos/test-connection

# Odpowiedź:
{
  "connected": true,
  "cloudId": "123456",
  "branches": [
    { "id": 1, "name": "SISI Burger Ciechanów" }
  ]
}
```

## Przepływ OAuth

```
┌─────────────┐     ┌─────────────────┐     ┌───────────────┐
│  Admin UI   │────▶│ /api/dotypos/   │────▶│  Dotypos      │
│  Settings   │     │ connector-url   │     │  OAuth Page   │
└─────────────┘     └─────────────────┘     └───────────────┘
                                                    │
                                                    ▼
┌─────────────┐     ┌─────────────────┐     ┌───────────────┐
│  Connected! │◀────│ /api/dotypos/   │◀────│  Callback     │
│  UI Update  │     │ callback        │     │  (redirect)   │
└─────────────┘     └─────────────────┘     └───────────────┘
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
dotypos_order_id    BIGINT      -- ID zamówienia w Dotypos
dotypos_receipt_id  BIGINT      -- ID paragonu
dotypos_sent_at     TIMESTAMPTZ -- Kiedy wysłano
dotypos_error       TEXT        -- Błąd (jeśli wystąpił)
```

## Rozwiązywanie problemów

### "Dotypos not connected"
→ Przejdź do `/admin/settings` i połącz się z Dotypos

### "No POS products available"
→ Uruchom synchronizację: `GET /api/dotypos/sync-products`

### "Token exchange failed"
→ Sprawdź czy `DOTYPOS_CLIENT_ID` i `DOTYPOS_CLIENT_SECRET` są poprawne

### Produkty nie są mapowane
→ Sprawdź czy nazwy produktów w Dotypos odpowiadają nazwom na stronie
→ Uruchom synchronizację produktów

## API Dotypos - Dokumentacja

- [Dotypos API v2 Docs](https://help.dotykacka.cz/cs/api2)
- [POS Actions](https://help.dotykacka.cz/cs/api2-pos-actions)
- [OAuth Flow](https://help.dotykacka.cz/cs/api2-authorization)

## Kolejne kroki

- [ ] Webhook do odbierania statusów zamówień
- [ ] Automatyczna synchronizacja produktów (cron)
- [ ] Panel mapowania produktów
- [ ] Historia wysłanych zamówień
