import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["sql.js"],
  allowedDevOrigins: [
    "*.run.app",
    "ais-dev-dsx5auzhpk6xdwoskro2ni-642037269403.asia-southeast1.run.app",
    "ais-pre-dsx5auzhpk6xdwoskro2ni-642037269403.asia-southeast1.run.app",
    "localhost:3000",
    "127.0.0.1:3000",
  ],
  async rewrites() {
    return [
      // Note detail pages are client-rendered by Studio. Keep the visible URL
      // while serving the already-static notes shell instead of invoking a
      // server-rendered dynamic route for every card open/back navigation.
      { source: "/notes/:id", destination: "/notes" },
    ]
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ]
  },
}

export default nextConfig
