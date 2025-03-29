"use client";

import { supabaseBrowser } from '@/lib/supabaseBrowser';

export default function AdminClient() {
  const handleLogout = async () => {
    await supabaseBrowser.auth.signOut();
    // Możesz zrobić window.location.reload() lub router.refresh()
    window.location.reload();
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Panel Administratora</h1>
      <p>Witaj w panelu admin!</p>

      <button onClick={handleLogout} className="mt-4 px-4 py-2 bg-red-500 text-white rounded">
        Wyloguj
      </button>
    </div>
  );
}
