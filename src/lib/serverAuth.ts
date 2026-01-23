// src/lib/serverAuth.ts
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/types/supabase";

export async function getSessionAndRole() {
  // 1) Tworzymy klienta z dostępem do ciasteczek
  const cookieStore = await cookies();

  // Next 15: cookies() jest async, a auth-helpers oczekuje obiektu store'a cookies (nie Promise).
  // Dlatego przekazujemy już await-nięty cookieStore i rzutujemy typ, żeby TS nie krzyczał.
  const supabase = createRouteHandlerClient<Database>({
    cookies: () => cookieStore as any,
  });

  // 2) Pobieramy sesję
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { session: null, role: null };
  }

  // 3) Pobieramy rolę użytkownika
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single<{ role: string | null }>();

  if (error) {
    console.error("Błąd pobierania profilu:", error);
    return { session, role: null };
  }

  return {
    session,
    role: profile?.role ?? null,
  };
}
