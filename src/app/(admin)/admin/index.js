// pages/admin/index.js
import Link from 'next/link';
import { supabase } from '@/lib/supabase'; // jeśli używasz aliasu @ lub ścieżki względnej
import React from 'react';

export default function AdminPage({ orders }) {
  return (
    <div className="flex min-h-screen">
      {/* MENU BOCZNE */}
      <nav className="w-64 bg-yellow-500 p-4 text-black">
        <h2 className="text-xl font-bold mb-6">Panel pracowników</h2>
        <ul className="space-y-2">
          <li>
            <Link href="/admin">
              <a className="block p-2 hover:bg-yellow-400">
                Bieżące zamówienia
              </a>
            </Link>
          </li>
          <li>
            <Link href="/admin/historia">
              <a className="block p-2 hover:bg-yellow-400">
                Historia zamówień
              </a>
            </Link>
          </li>
          <li>
            <Link href="/admin/ustawienia">
              <a className="block p-2 hover:bg-yellow-400">
                Ustawienia
              </a>
            </Link>
          </li>
        </ul>
      </nav>

      {/* GŁÓWNA CZĘŚĆ - bieżące zamówienia */}
      <main className="flex-1 p-6 bg-yellow-100">
        <h1 className="text-2xl font-bold mb-4">Bieżące zamówienia</h1>

        {orders?.length ? (
          <ul className="space-y-4">
            {orders.map((order) => (
              <li key={order.id} className="bg-white p-4 rounded shadow">
                <p>Klient: {order.customer_name}</p>
                <p>Kwota: {order.total_price} zł</p>
                <p>Data: {new Date(order.created_at).toLocaleString()}</p>

                {/* Ustawianie czasu dostawy */}
                <div className="mt-2">
                  <span className="font-semibold">Czas dostawy:</span>
                  <button className="ml-2 px-3 py-1 bg-green-500 text-white rounded mr-2">
                    30 min
                  </button>
                  <button className="px-3 py-1 bg-green-500 text-white rounded mr-2">
                    1h
                  </button>
                  <button className="px-3 py-1 bg-green-500 text-white rounded mr-2">
                    1.5h
                  </button>
                  <button className="px-3 py-1 bg-green-500 text-white rounded mr-2">
                    2h
                  </button>
                </div>

                {/* Anulowanie lub wydłużenie */}
                <div className="mt-2">
                  <button className="px-4 py-2 bg-red-500 text-white rounded mr-2">
                    Anuluj
                  </button>
                  <button className="px-4 py-2 bg-blue-500 text-white rounded">
                    Wydłuż
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p>Brak zamówień na dziś.</p>
        )}
      </main>
    </div>
  );
}

// getServerSideProps - pobiera bieżące zamówienia (np. z dnia dzisiejszego)
export async function getServerSideProps() {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    // Przykład: zamówienia z dzisiejszej daty
    .gte('created_at', today) 
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Błąd pobierania zamówień:', error);
    return { props: { orders: [] } };
  }

  return {
    props: {
      orders: orders ?? [],
    },
  };
}
