// app/robots.ts
import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.sisiciechanow.pl";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/" , disallow: ["/api/", "/wp-admin", "/wp-content", "/wp-includes", "/wp-json", "/xmlrpc.php"] }
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
