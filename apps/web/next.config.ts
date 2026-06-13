import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @repo/api-client is consumed as TS source from the workspace.
  transpilePackages: ["@repo/api-client"],
};

export default nextConfig;
