// app/sitemap.ts
import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.sisiciechanow.pl";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPaths = ["", "/menu", "/rezerwacje", "/kontakt", "/regulamin", "/polityka-prywatnosci"];

  const staticEntries: MetadataRoute.Sitemap = staticPaths.map((p) => ({
    url: `${BASE}${p || "/"}`,
    lastModified: now,
    changeFrequency: p === "" ? "weekly" : "monthly",
    priority: p === "" ? 1 : 0.6,
  }));

  // PRZYKŁAD dynamicznych podstron menu (odkomentuj i dostosuj):
  // const res = await fetch(`${BASE}/api/menu`, { next: { revalidate: 60 } });
  // const items: { slug: string; updatedAt?: string }[] = await res.json();
  // const dynamicEntries: MetadataRoute.Sitemap = items.map((i) => ({
  //   url: `${BASE}/menu/${i.slug}`,
  //   lastModified: i.updatedAt ? new Date(i.updatedAt) : now,
  //   changeFrequency: "weekly",
  //   priority: 0.6,
  // }));

  return [
    ...staticEntries,
    // ...dynamicEntries,
  ];
}
