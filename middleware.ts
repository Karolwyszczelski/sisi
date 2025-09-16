import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/types/supabase";

const WP_GONE = ["/wp-admin", "/wp-content", "/wp-includes", "/wp-json", "/xmlrpc.php"];

const isJsonRequest = (req: NextRequest) => {
  const accept = req.headers.get("accept") ?? "";
  const xhr = req.headers.get("x-requested-with") ?? "";
  return accept.includes("application/json") || xhr === "XMLHttpRequest" || req.nextUrl.pathname.startsWith("/api/");
};

export async function middleware(req: NextRequest) {
  const { pathname, origin } = req.nextUrl;

  // 1) Twarde 410 + noindex dla starych ścieżek WP
  if (WP_GONE.some((p) => pathname.startsWith(p))) {
    const res = new NextResponse("Gone", { status: 410 });
    res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    return res;
  }

  // 2) Ochrona tylko pod /admin
  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  // /admin/login dostępne bez sesji
  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  const res = NextResponse.next();
  const supabase = createMiddlewareClient<Database>({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Brak sesji → JSON 401 lub redirect do /admin/login?r=...
  if (!session) {
    if (isJsonRequest(req)) {
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    const url = new URL("/admin/login", origin);
    url.searchParams.set("r", pathname);
    return NextResponse.redirect(url);
  }

  // Pobierz rolę (admin/employee/client)
  let role: string | null = null;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle();
    if (!error) role = data?.role ?? null;
  } catch {}

  // Root /admin → przekierowanie do właściwego panelu
  if (pathname === "/admin") {
    const dest =
      role === "admin"
        ? "/admin/AdminPanel"
        : role === "employee"
        ? "/admin/EmployeePanel"
        : "/";
    if (dest !== pathname) return NextResponse.redirect(new URL(dest, origin));
  }

  // Klient nie ma wstępu do /admin/*
  if (role === "client") {
    return NextResponse.redirect(new URL("/", origin));
  }

  return res;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/wp-admin/:path*",
    "/wp-content/:path*",
    "/wp-includes/:path*",
    "/wp-json/:path*",
    "/xmlrpc.php",
  ],
};
