"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export default function VerifyClient() {
  const supabase = createClientComponentClient({ options: { auth: { flowType: "implicit" } } });
  const router = useRouter();
  const [msg, setMsg] = useState("Weryfikuję link…");

  useEffect(() => {
    (async () => {
      try {
        const url = new URL(window.location.href);
        const sp = url.searchParams;
        const hp = new URLSearchParams(url.hash.replace(/^#/, ""));
        const next = sp.get("next") || "/?verified=1";

        // Błędy z linku
        const err = sp.get("error") || sp.get("error_code");
        const errDesc = sp.get("error_description");
        if (err || errDesc) throw new Error(errDesc || err!);

        // Najpierw spróbuj uniwersalnie (obsługuje #access_token i ?code)
        const got = await supabase.auth.getSessionFromUrl({ storeSession: true });
        if (!got.error && got.data?.session) {
          setMsg("Adres e-mail potwierdzony. Loguję…");
          router.replace(next);
          return;
        }

        // Fallbacki:
        const code = sp.get("code");
        if (code) throw new Error("Nie mogę zweryfikować (brak code_verifier). Otwórz link w tej samej przeglądarce lub poproś o nowy link.");

        const token_hash = sp.get("token_hash");
        const type = sp.get("type") as "signup" | "magiclink" | "recovery" | "email_change" | null;
        if (token_hash && type) {
          const { error } = await supabase.auth.verifyOtp({ token_hash, type });
          if (error) throw error;
          setMsg("Adres e-mail potwierdzony. Loguję…");
          router.replace(next);
          return;
        }

        setMsg("Błąd potwierdzania: brak parametrów weryfikacji w URL.");
      } catch (e: any) {
        setMsg(`Błąd potwierdzania: ${e?.message ?? "nieznany"}`);
      }
    })();
  }, [router, supabase]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="rounded-lg bg-white/60 p-6 text-center">
        <h1 className="text-2xl font-bold mb-2">Weryfikacja</h1>
        <p>{msg}</p>
      </div>
    </div>
  );
}
