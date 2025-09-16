import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const host = "https://www.sisiciechanow.pl";
  return {
    host,
    sitemap: `${host}/sitemap.xml`,
    rules: [
      {
        userAgent: "*",
        disallow: [
          "/wp-admin/",
          "/wp-content/",
          "/wp-includes/",
          "/wp-json/",
          "/xmlrpc.php",
          "/?*",
        ],
      },
    ],
  };
}
