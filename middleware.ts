// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { Database } from "@/types/supabase";

const isJsonRequest = (req: NextRequest) => {
  const accept = req.headers.get("accept") || "";
  const xRequested = req.headers.get("x-requested-with") || "";
  return accept.includes("application/json") || xRequested === "XMLHttpRequest";
};

export async function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const res = NextResponse.next();
  const supabase = createMiddlewareClient<Database>({ req, res });

  // Pobierz sesję
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Brak sesji
  if (!session) {
    if (isJsonRequest(req)) {
      return new NextResponse(
        JSON.stringify({ error: "Brak sesji. Niezalogowany." }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    } else {
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }
  }

  // Pobierz rolę (bez crashowania, jeśli coś nie zadziała)
  let role: string | null = null;
  try {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();
    if (!error && profile) {
      role = profile.role;
    }
  } catch (e) {
    console.warn("Nie udało się pobrać roli użytkownika w middleware:", e);
  }

  // Ochrona panelu / redirecty
  if (url.pathname.startsWith("/admin")) {
    if (role === "client") {
      // klient nie ma dostępu do /admin
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

    if (url.pathname === "/admin") {
      if (role === "admin") {
        url.pathname = "/admin/AdminPanel";
        return NextResponse.redirect(url);
      } else if (role === "employee") {
        url.pathname = "/admin/EmployeePanel";
        return NextResponse.redirect(url);
      }
    }
  }

  return res;
}

export const config = {
  matcher: ["/admin/:path*"],
};
