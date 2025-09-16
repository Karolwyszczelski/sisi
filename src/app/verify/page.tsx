"use client";
import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useRouter } from "next/navigation";

export default function VerifyPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [msg, setMsg] = useState("Potwierdzanie…");

  useEffect(() => {
    (async () => {
      const { error } = await supabase.auth.exchangeCodeForSession();
      if (error) {
        setMsg("Błąd potwierdzania: " + error.message);
        return;
      }
      setMsg("Konto potwierdzone! Loguję…");
      setTimeout(() => router.push("/?verified=1"), 1200);
    })();
  }, [supabase, router]);

  return (
    <div className="min-h-[60vh] grid place-items-center p-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Weryfikacja</h1>
        <p>{msg}</p>
      </div>
    </div>
  );
}
