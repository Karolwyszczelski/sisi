// app/sitemap.ts
import type { MetadataRoute } from "next";
const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.sisiciechanow.pl";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/menu", "/rezerwacje", "/kontakt", "/regulamin", "/polityka-prywatnosci"];
  return pages.map((p) => ({
    url: `${BASE}${p || "/"}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: p ? 0.6 : 1,
  }));
}
