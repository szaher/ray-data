import createMDX from "@next/mdx";
import type { NextConfig } from "next";

const isStaticExport = process.env.NEXT_PUBLIC_STATIC_EXPORT === "true";

const nextConfig: NextConfig = {
  output: isStaticExport ? "export" : "standalone",
  basePath: isStaticExport ? (process.env.NEXT_PUBLIC_BASE_PATH || "") : "",
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
  turbopack: {
    root: process.cwd(),
  },
};

const withMDX = createMDX({
  extension: /\.mdx?$/,
});

export default withMDX(nextConfig);
