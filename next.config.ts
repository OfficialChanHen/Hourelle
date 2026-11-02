import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // the link preview image reads its fonts and the icon from disk at run time
  outputFileTracingIncludes: {
    "/api/preview/[id]": ["./assets/fonts/**", "./public/brand/**"],
  },
  async redirects() {
    // the price list used to live at /plans, before "plan" became the word for the thing people coordinate
    return [{ source: "/plans", destination: "/pricing", permanent: true }];
  },
};

export default nextConfig;
