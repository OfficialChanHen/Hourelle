import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // the link preview image reads its fonts and the icon from disk at run time
  outputFileTracingIncludes: {
    "/api/preview/[id]": ["./assets/fonts/**", "./public/brand/**"],
  },
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        // a plan's address is its permission, so it never leaves in a Referer: other
        // sites (map tiles, Stripe) see only the origin
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        // nobody frames the app (clickjacking); no plugins, no foreign <base>, forms post home
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
        { key: "Strict-Transport-Security", value: "max-age=63072000" },
      ],
    }];
  },
  async redirects() {
    // the price list used to live at /plans, before "plan" became the word for the thing people coordinate
    return [{ source: "/plans", destination: "/pricing", permanent: true }];
  },
};

export default nextConfig;
