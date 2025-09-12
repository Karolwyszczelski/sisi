// src/app/api/payments/create-transaction/route.ts
import { NextResponse } from "next/server";
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orderId, amount, email, customerName } = body;

    // Pobierz swoje dane z Przelewy24 (MUSISZ JE DODAĆ DO .env.local)
    const P24_MERCHANT_ID = process.env.P24_MERCHANT_ID!;
    const P24_POS_ID = process.env.P24_POS_ID!; // Zazwyczaj to to samo co merchant_id
    const P24_CRC_KEY = process.env.P24_CRC_KEY!;
    const P24_API_KEY = process.env.P24_API_KEY!; // Klucz do API
    
    // Sprawdź, czy wszystkie zmienne środowiskowe są ustawione
    if (!P24_MERCHANT_ID || !P24_POS_ID || !P24_CRC_KEY || !P24_API_KEY) {
      throw new Error("Brak konfiguracji Przelewy24 w zmiennych środowiskowych.");
    }

    // Unikalny identyfikator sesji dla tej transakcji
    const sessionId = `${orderId}-${new Date().getTime()}`;

    // Dane transakcji
    const transactionData = {
      merchantId: parseInt(P24_MERCHANT_ID),
      posId: parseInt(P24_POS_ID),
      sessionId: sessionId,
      amount: Math.round(amount * 100), // Kwota w groszach
      currency: "PLN",
      description: `Zamówienie #${orderId}`,
      email: email,
      client: customerName,
      country: "PL",
      language: "pl",
      urlReturn: `${process.env.NEXT_PUBLIC_BASE_URL}/order/success?orderId=${orderId}`, // URL powrotu po udanej płatności
      urlStatus: `${process.env.NEXT_PUBLIC_BASE_URL}/api/payments/webhook`, // URL na który P24 wyśle powiadomienie (webhook)
      sign: "", // Podpis wygenerujemy poniżej
    };

    // Generowanie podpisu (sign) - kluczowy element bezpieczeństwa
    const jsonToSign = JSON.stringify({
      sessionId: transactionData.sessionId,
      merchantId: transactionData.merchantId,
      amount: transactionData.amount,
      currency: transactionData.currency,
      crc: P24_CRC_KEY,
    });

    transactionData.sign = crypto.createHmac('sha384', P24_API_KEY).update(jsonToSign).digest('hex');

    // Rejestracja transakcji w Przelewy24
    const p24Response = await fetch("https://sandbox.przelewy24.pl/api/v1/transaction/register", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            // W nowym API autoryzacja jest przez Basic Auth
            'Authorization': 'Basic ' + Buffer.from(`${P24_POS_ID}:${P24_API_KEY}`).toString('base64')
        },
        body: JSON.stringify(transactionData)
    });

    const p24Result = await p24Response.json();

    if (p24Response.status !== 200 || !p24Result.data?.token) {
        console.error("Błąd odpowiedzi z Przelewy24:", p24Result);
        throw new Error(p24Result.error || "Nie udało się zarejestrować transakcji w Przelewy24.");
    }
    
    // Generujemy link do płatności
    const paymentUrl = `https://sandbox.przelewy24.pl/trnRequest/${p24Result.data.token}`;

    return NextResponse.json({ paymentUrl });

  } catch (error: any) {
    console.error("[P24_CREATE_TRANSACTION_ERROR]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}