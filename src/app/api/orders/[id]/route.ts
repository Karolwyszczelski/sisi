import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await request.json(); // oczekujemy np. { status: "accepted", deliveryTime: "30 min" }
    const { status, deliveryTime } = body;

    const { data, error } = await supabase
      .from('orders')
      .update({ status, delivery_time: deliveryTime })
      .eq('id', id)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
