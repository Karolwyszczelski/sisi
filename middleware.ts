// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/types/supabase";

/** twardo wycinane ścieżki WP */
const WP_PREFIXES = [
  "/wp-admin",
  "/wp-content",
  "/wp-includes",
  "/wp-json",
  "/xmlrpc.php",
  "/feed",
  "/comments-feed",
  "/category",
  "/tag",
  "/author",
  "/archives",
] as const;

const isJsonRequest = (req: NextRequest) => {
  const accept = req.headers.get("accept") ?? "";
  const xhr = req.headers.get("x-requested-with") ?? "";
  return accept.includes("application/json") || xhr === "XMLHttpRequest" || req.nextUrl.pathname.startsWith("/api/");
};

const spamGone = (pathname: string, req: NextRequest) => {
  // 1) twarde prefiksy
  if (WP_PREFIXES.some((p) => pathname.startsWith(p))) return true;

  // 2) archiwa typu /YYYY/MM/DD/...
  if (/^\/\d{4}\/\d{2}(?:\/\d{2})?\b/i.test(pathname)) return true;

  // 3) parametry wyszukiwarki WP (?s=) lub stare ID posta (?p=123)
  const sp = req.nextUrl.searchParams;
  if (sp.has("s") || sp.has("p")) return true;

  // 4) śmieciowe ścieżki z CJK (częsty objaw spamu), zostawiamy whitelistę
  const whitelist = new Set([
    "/",
    "/menu",
    "/polityka-prywatnosci",
    "/regulamin",
    "/kontakt",
    "/rezerwacje",
    "/pickup-order",
  ]);
  const looksCJK = /[\u3040-\u30ff\u3400-\u9fff]/.test(decodeURIComponent(pathname));
  if (looksCJK && !whitelist.has(pathname)) return true;

  return false;
};

export async function middleware(req: NextRequest) {
  const { pathname, origin } = req.nextUrl;

  // --- 410 + X-Robots-Tag dla starych/śmieciowych URL-i ---
  if (spamGone(pathname, req)) {
    const res = new NextResponse("Gone", { status: 410 });
    res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    return res;
  }

  // --- poza /admin nie ruszamy nic ---
  if (!pathname.startsWith("/admin")) return NextResponse.next();

  // /admin/login dostępne bez sesji
  if (pathname === "/admin/login") return NextResponse.next();

  const res = NextResponse.next();
  const supabase = createMiddlewareClient<Database>({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Brak sesji → JSON 401 albo redirect z powrotem po zalogowaniu
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

  // Pobierz rolę
  let role: string | null = null;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle();
    if (!error) role = data?.role ?? null;
  } catch {
    /* ignore */
  }

  // Root /admin → przekierowanie wg roli
  if (pathname === "/admin") {
    const dest =
      role === "admin"
        ? "/admin/AdminPanel"
        : role === "employee"
        ? "/admin/EmployeePanel"
        : "/";
    if (dest !== pathname) return NextResponse.redirect(new URL(dest, origin));
  }

  // Klient nie ma dostępu do /admin/*
  if (role === "client") return NextResponse.redirect(new URL("/", origin));

  return res;
}

export const config = {
  matcher: [
    // admin
    "/admin/:path*",
    // legacy WP/spam
    "/wp-admin/:path*",
    "/wp-content/:path*",
    "/wp-includes/:path*",
    "/wp-json/:path*",
    "/xmlrpc.php",
    "/feed",
    "/comments-feed",
    "/category/:path*",
    "/tag/:path*",
    "/author/:path*",
    "/archives/:path*",
    // archiwa dat: /YYYY/MM(/DD)/*
    "/:year(\\d{4})/:month(\\d{2})/:path*",
  ],
};
