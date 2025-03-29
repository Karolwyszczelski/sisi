"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const { error } = await supabaseBrowser.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      // Po zalogowaniu odśwież SSR (serwer), żeby zobaczył sesję w cookies
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-400 to-purple-600 p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-6 space-y-4">
        {/* Nagłówek/logowanie */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-700">Logowanie do panelu</h1>
          <p className="text-sm text-gray-500">Uzyskaj dostęp do panelu administracyjnego</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Komunikat błędu */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded relative">
              {error}
            </div>
          )}

          {/* Pole Email */}
          <div>
            <label className="block text-gray-700 font-medium mb-1">Email</label>
            <input
              type="email"
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Podaj email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {/* Pole Hasło */}
          <div>
            <label className="block text-gray-700 font-medium mb-1">Hasło</label>
            <input
              type="password"
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Podaj hasło"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {/* Przycisk Logowania */}
          <button
            type="submit"
            className="w-full bg-blue-500 text-white font-medium py-2 rounded hover:bg-blue-600 transition-colors"
          >
            Zaloguj
          </button>
        </form>

        {/* (Opcjonalne) Link do resetu hasła lub innej strony */}
        <div className="text-center">
          <a
            href="#"
            className="text-sm text-blue-500 hover:underline"
          >
            Zapomniałeś hasła?
          </a>
        </div>
      </div>
    </div>
  );
}
