// app/api/orders/current/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

console.log("SUPABASE_SERVICE_KEY =>", process.env.SUPABASE_SERVICE_KEY);

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const { data, error } = await supabase
    .from('orders')
    .select('*');

  if (error) {
    console.error('Błąd pobierania zamówień:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ orders: data }, { status: 200 });
}
