import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://www.sisiciechanow.pl";
  const now = new Date();
  return [
    { url: `${base}/menu`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/polityka-prywatnosci`, changeFrequency: "yearly", priority: 0.6 },
    { url: `${base}/regulamin`, changeFrequency: "yearly", priority: 0.6 },
  ];
}
