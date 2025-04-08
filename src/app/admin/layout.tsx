"use client";

import React, { useState } from "react";
import Sidebar from "@/components/sidebar";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { SessionContextProvider } from "@supabase/auth-helpers-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // Tworzymy klienta Supabase tylko raz
  const [supabaseClient] = useState(() => createClientComponentClient());

  return (
    <SessionContextProvider supabaseClient={supabaseClient}>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-6 bg-gray-100">
          {children}
        </main>
      </div>
    </SessionContextProvider>
  );
}
