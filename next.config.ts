import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  // Jeśli kiedyś hostujesz bez optymalizacji obrazów (nie Vercel), odkomentuj:
  // images: { unoptimized: true },
};

export default nextConfig;
