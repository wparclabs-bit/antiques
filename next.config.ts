import type { NextConfig } from "next";

// Pin the workspace root explicitly: a stray package-lock.json in the parent
// folder otherwise makes Next guess D:\WingAI\Projects and scatter build
// output into Antiques/Antiques/.next. npm scripts and Vercel both run with
// the project root as the working directory.
const projectRoot = process.cwd();

const nextConfig: NextConfig = {
  outputFileTracingRoot: projectRoot,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    root: projectRoot,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
