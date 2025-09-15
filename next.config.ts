// next.config.ts
import type { NextConfig } from "next";

const csp = [
  // Domyślne źródła
  "default-src 'self'",
  "base-uri 'self'",
  "block-all-mixed-content",

  // Zasoby
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' blob: data: https://*.googleusercontent.com https://*.ggpht.com https://maps.gstatic.com https://maps.googleapis.com",
  "object-src 'none'",

  // Skrypty / style (uwaga: Google Maps i Next wymagają pewnej elastyczności)
  "script-src 'self' 'unsafe-inline' https://maps.googleapis.com https://maps.gstatic.com https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",

  // Połączenia sieciowe (Supabase, Google Maps/Places, P24)
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://maps.googleapis.com https://*.googleapis.com https://*.google.com https://secure.przelewy24.pl https://sandbox.przelewy24.pl",

  // Iframe’y Google (np. podpowiedzi Places)
  "frame-src 'self' https://*.google.com https://*.gstatic.com",

  // Formularze (powrót/status P24)
  "form-action 'self' https://secure.przelewy24.pl https://sandbox.przelewy24.pl",

  // Inne
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  output: "standalone",
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  poweredByHeader: false, // usuń X-Powered-By

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // CSP
          { key: "Content-Security-Policy", value: csp },

          // Twarde HTTPS (włącz preload tylko jeśli domena jest na HSTS preload list lub planujesz zgłosić)
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },

          // Anty-sniffing + clickjacking + bezpieczne referrery
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

          // Ogranicz możliwości przeglądarki (dostosuj w razie potrzeby)
          {
            key: "Permissions-Policy",
            value: [
              "accelerometer=()",
              "ambient-light-sensor=()",
              "autoplay=()",
              "camera=()",
              "display-capture=()",
              "encrypted-media=()",
              "fullscreen=()",
              "geolocation=()",
              "gyroscope=()",
              "magnetometer=()",
              "microphone=()",
              "midi=()",
              "payment=()",
              "picture-in-picture=()",
              "usb=()",
              "xr-spatial-tracking=()",
            ].join(", "),
          },

          // Izolacja okna (dobry default; nie włączamy COEP, żeby nie zablokować zewn. zasobów)
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
    ];
  },

  // Jeśli kiedyś hostujesz bez optymalizacji obrazów (nie Vercel), odkomentuj:
  // images: { unoptimized: true },
};

export default nextConfig;
