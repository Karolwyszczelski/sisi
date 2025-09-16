// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/types/supabase";

/** twardo wycinane ścieżki WP */
const WP_PREFIXES = [
  "/wp-admin","/wp-content","/wp-includes","/wp-json","/xmlrpc.php",
  "/feed","/comments-feed","/category","/tag","/author","/archives",
] as const;

const CANONICAL_HOST = process.env.NEXT_PUBLIC_BASE_HOST ?? "www.sisiciechanow.pl";

const isJsonRequest = (req: NextRequest) => {
  const accept = req.headers.get("accept") ?? "";
  const xhr = req.headers.get("x-requested-with") ?? "";
  return accept.includes("application/json") || xhr === "XMLHttpRequest" || req.nextUrl.pathname.startsWith("/api/");
};

const spamGone = (pathname: string, req: NextRequest) => {
  if (WP_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  if (/^\/\d{4}\/\d{2}(?:\/\d{2})?\b/i.test(pathname)) return true;

  const sp = req.nextUrl.searchParams;
  if (sp.has("s") || sp.has("p")) return true;

  const whitelist = new Set([
    "/","/menu","/polityka-prywatnosci","/regulamin","/kontakt","/rezerwacje","/pickup-order",
  ]);
  const looksCJK = /[\u3040-\u30ff\u3400-\u9fff]/.test(decodeURIComponent(pathname));
  if (looksCJK && !whitelist.has(pathname)) return true;

  return false;
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 0) kanoniczny host + HTTPS (bez pętli na preview/localhost)
  const host = req.headers.get("host") ?? "";
  const isPreview = host.endsWith(".vercel.app") || host.startsWith("localhost") || host.startsWith("127.0.0.1");
  if (!isPreview && host && host !== CANONICAL_HOST) {
    const url = new URL(req.url);
    url.protocol = "https:";   // <— DODANE
    url.host = CANONICAL_HOST; // <— KANONIKALNY HOST
    url.port = "";             // <— bez przypadkowego :80/:443
    return NextResponse.redirect(url, 308);
  }

  // 1) 410 + noindex dla legacy/spam
  if (spamGone(pathname, req)) {
    const res = new NextResponse("Gone", { status: 410 });
    res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    return res;
  }

  // 2) poza /admin – przepuszczamy
  if (!pathname.startsWith("/admin")) return NextResponse.next();
  if (pathname === "/admin/login") return NextResponse.next();

  const res = NextResponse.next();
  const supabase = createMiddlewareClient<Database>({ req, res });
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    if (isJsonRequest(req)) {
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
    }
    const url = new URL("/admin/login", req.nextUrl.origin);
    url.searchParams.set("r", pathname);
    return NextResponse.redirect(url);
  }

  let role: string | null = null;
  try {
    const { data } = await supabase.from("profiles").select("role").eq("id", session.user.id).maybeSingle();
    role = data?.role ?? null;
  } catch {}

  if (pathname === "/admin") {
    const dest = role === "admin" ? "/admin/AdminPanel" : role === "employee" ? "/admin/EmployeePanel" : "/";
    if (dest !== pathname) return NextResponse.redirect(new URL(dest, req.nextUrl.origin));
  }

  if (role === "client") return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  return res;
}

// obsługujemy wszystko poza assetami/_next (robots.txt, sitemap.xml omijamy)
export const config = { matcher: ["/((?!_next|.*\\..*).*)"] };
