import type { NextConfig } from "next";

const remoteMcpPaths = [
  "/mcp",
  "/mcp/approve",
  "/authorize",
  "/register",
  "/token",
  "/revoke",
  "/.well-known/oauth-authorization-server",
  "/.well-known/oauth-protected-resource/mcp",
];

const nextConfig: NextConfig = {
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (!backendUrl?.trim()) return [];

    // OAuth and MCP are served at the backend origin, outside the REST prefix.
    const { origin } = new URL(backendUrl);
    return remoteMcpPaths.map((source) => ({
      source,
      destination: origin + source,
    }));
  },
};

export default nextConfig;
