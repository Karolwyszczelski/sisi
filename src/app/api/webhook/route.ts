import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const data = await req.json();
    console.log('[Webhook] Odebrano dane od Przelewy24:', data);

    const orderId = data.orderId || data.sessionId || data.id;
    // Ustawiamy domyślny status na "new" jeśli nie jest przesłany
    const status = data.status || 'new';

    // Nowe pola - upewnij się, że istnieją w tabeli:
    //   address, phone, products, total_price
    const address = data.address || "";
    const phone = data.phone || "";
    const products = data.products || "";
    const total_price = data.total_price || 0;

    if (!orderId) {
      return NextResponse.json({ error: 'Brak orderId' }, { status: 400 });
    }

    // Aktualizujemy rekord zamówienia, ustawiając dodatkowe kolumny
    const { error } = await supabase
      .from('orders')
      .update({
        status,
        address,
        phone,
        products,
        total_price
      })
      .eq('id', orderId);

    if (error) {
      console.error('Błąd aktualizacji Supabase:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Webhook] Błąd:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
