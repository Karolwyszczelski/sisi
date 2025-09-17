// next.config.ts
import type { NextConfig } from "next";

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "block-all-mixed-content",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' blob: data: https://*.googleusercontent.com https://*.ggpht.com https://maps.gstatic.com https://maps.googleapis.com https://lottie.host",
  "media-src 'self'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://maps.googleapis.com https://maps.gstatic.com https://www.googletagmanager.com https://challenges.cloudflare.com",
  "script-src-elem 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://maps.googleapis.com https://maps.gstatic.com https://www.googletagmanager.com https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://maps.googleapis.com https://*.googleapis.com https://*.google.com https://secure.przelewy24.pl https://sandbox.przelewy24.pl https://challenges.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com https://lottie.host",
  "frame-src 'self' https://*.google.com https://*.gstatic.com https://challenges.cloudflare.com https://secure.przelewy24.pl https://sandbox.przelewy24.pl",
  "form-action 'self' https://secure.przelewy24.pl https://sandbox.przelewy24.pl",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.googleusercontent.com" },
      { protocol: "https", hostname: "*.ggpht.com" },
      { protocol: "https", hostname: "maps.gstatic.com" },
      { protocol: "https", hostname: "maps.googleapis.com" },
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: [
              "accelerometer=()","ambient-light-sensor=()","autoplay=()","camera=()","display-capture=()",
              "encrypted-media=()","fullscreen=()","geolocation=()","gyroscope=()","magnetometer=()",
              "microphone=()","midi=()","payment=()","picture-in-picture=()","usb=()","xr-spatial-tracking=()",
            ].join(", "),
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          { key: "Content-Language", value: "pl" },
        ],
      },
      { source: "/order/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/admin/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/wp-:slug*(.*)", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/xmlrpc.php", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/category/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/tag/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },

  // TWARDY CUT parametrów z dawnych WP (zapytania typu ?s=, ?p= itd.)
  async redirects() {
    const spamParams = ["s","p","m","paged","cat","attachment_id","replytocom"] as const;
    const rules = spamParams.map((key) => ({
      source: "/:path*",                             // dowolna ścieżka
      has: [{ type: "query", key } as const],        // jeśli dany parametr istnieje
      destination: "/gone",                          // przenosimy na /gone
      permanent: false,                              // 302/307
    }));
    return rules;
  },

  // Dla pewności – legacy WP ścieżki na /gone (HTTP 200 z treścią /gone lub 410 w middleware)
  async rewrites() {
    return [
      { source: "/wp-admin/:path*", destination: "/gone" },
      { source: "/wp-content/:path*", destination: "/gone" },
      { source: "/wp-includes/:path*", destination: "/gone" },
      { source: "/xmlrpc.php", destination: "/gone" },
      { source: "/category/:path*", destination: "/gone" },
      { source: "/tag/:path*", destination: "/gone" },
    ];
  },
};

export default nextConfig;
