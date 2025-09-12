// src/app/api/payments/webhook/route.ts
import { NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Klient Supabase z uprawnieniami serwera
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log("🔔 Otrzymano powiadomienie z Przelewy24:", body);

    const { merchantId, posId, sessionId, amount, currency, orderId } = body;

    // Pobierz swoje klucze z .env.local
    const P24_MERCHANT_ID = parseInt(process.env.P24_MERCHANT_ID!);
    const P24_POS_ID = parseInt(process.env.P24_POS_ID!);
    const P24_API_KEY = process.env.P24_API_KEY!;
    const P24_CRC_KEY = process.env.P24_CRC_KEY!;

    // --- Krok 1: Weryfikacja autentyczności powiadomienia (podpis) ---
    const sign = body.sign;
    const jsonToSign = JSON.stringify({
      merchantId: merchantId,
      posId: posId,
      sessionId: sessionId,
      amount: amount,
      currency: currency,
      orderId: orderId,
      crc: P24_CRC_KEY,
    });
    
    const expectedSign = crypto.createHmac('sha384', P24_API_KEY).update(jsonToSign).digest('hex');

    // To jest podstawowe zabezpieczenie, sprawdzamy czy podpis się zgadza.
    // W nowym API REST weryfikacja odbywa się przez PUT (poniżej),
    // ale warto zostawić tę kontrolę jako pierwszą linię obrony.
    if (sign !== expectedSign) {
       console.error("❌ Błąd weryfikacji podpisu powiadomienia (CRC)!");
       return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // --- Krok 2: Wyciągnięcie ID naszego zamówienia z sessionId ---
    const ourOrderId = sessionId.split('-')[0];
    if (!ourOrderId) {
      throw new Error("Nie znaleziono ID zamówienia w sessionId powiadomienia.");
    }

    // --- Krok 3: AKTYWNA WERYFIKACJA TRANSAKCJI W PRZELEWY24 ---
    console.log(`📠 Weryfikowanie transakcji dla sessionId: ${sessionId} w Przelewy24...`);

    const verificationData = {
      merchantId: P24_MERCHANT_ID,
      posId: P24_POS_ID,
      sessionId: sessionId,
      amount: amount,
      currency: currency,
      orderId: orderId,
      sign: "" // Podpis generujemy poniżej
    };

    const verificationJsonToSign = JSON.stringify({
        sessionId: sessionId,
        orderId: orderId,
        amount: amount,
        currency: currency,
        crc: P24_CRC_KEY
    });
    verificationData.sign = crypto.createHmac('sha384', P24_API_KEY).update(verificationJsonToSign).digest('hex');

    const p24VerificationResponse = await fetch("https://sandbox.przelewy24.pl/api/v1/transaction/verify", {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Basic ' + Buffer.from(`${P24_POS_ID}:${P24_API_KEY}`).toString('base64')
        },
        body: JSON.stringify(verificationData)
    });

    const verificationResult = await p24VerificationResponse.json();

    if (p24VerificationResponse.status !== 200 || verificationResult.data?.status !== "success") {
        console.error("❌ Weryfikacja w Przelewy24 nie powiodła się lub transakcja nie jest opłacona.", verificationResult);
        // Nie aktualizujemy zamówienia, bo płatność nie jest potwierdzona.
        // Można by tu np. ustawić status "failed".
        await supabaseAdmin.from('orders').update({ status: 'failed' }).eq('id', ourOrderId);
        return NextResponse.json({ error: "Verification failed" }, { status: 400 });
    }
    
    console.log("✅ Weryfikacja w Przelewy24 pomyślna. Status transakcji: success.");

    // --- Krok 4: Aktualizacja statusu zamówienia w naszej bazie ---
    // Robimy to DOPIERO po pomyślnej weryfikacji
    console.log(`Aktualizowanie zamówienia o ID: ${ourOrderId} na status 'placed'...`);

    const { error } = await supabaseAdmin
      .from('orders')
      .update({ status: 'placed' }) // Zmieniamy status na 'opłacone i złożone'
      .eq('id', ourOrderId)
      .eq('status', 'pending'); // Dodatkowy warunek, aby nie zaktualizować już przetworzonego zamówienia

    if (error) {
      throw new Error(`Błąd aktualizacji zamówienia w bazie danych: ${error.message}`);
    }

    console.log(`✅ Zamówienie #${ourOrderId} zostało pomyślnie opłacone i zaktualizowane w bazie.`);

    // --- Krok 5: Odpowiedź do Przelewy24 ---
    return NextResponse.json({ status: "ok" });

  } catch (error: any) {
    console.error("[P24_WEBHOOK_ERROR]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}