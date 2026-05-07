import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname, "../.."),
  outputFileTracingIncludes: {
    "/**/*": ["../../data/processed/**/*.json", "../../data/processed/**/*.geojson"],
  },
};

export default nextConfig;
