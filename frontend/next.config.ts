import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@napi-rs/canvas"],
  outputFileTracingIncludes: {
    "/api/share-image": ["./public/fonts/**", "./public/logos/**"],
  },
};

export default nextConfig;