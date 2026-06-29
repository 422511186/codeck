import { networkInterfaces } from "node:os";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

function configuredDevOrigins() {
  const defaults = ["127.0.0.1", "localhost"];
  const explicit = (process.env.CODEX_WEB_ALLOWED_DEV_ORIGINS || "")
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const bindHost = process.env.CODEX_WEB_BIND_HOST?.trim();

  if (!bindHost || bindHost === "0.0.0.0" || bindHost === "::") {
    return [...new Set([...defaults, ...externalInterfaceAddresses(), ...explicit])];
  }

  return [...new Set([...defaults, bindHost, ...explicit])];
}

function externalInterfaceAddresses() {
  return Object.values(networkInterfaces())
    .flatMap((entries) => entries ?? [])
    .filter((entry) => entry.family === "IPv4" && !entry.internal)
    .map((entry) => entry.address);
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: configuredDevOrigins(),
  devIndicators: false,
  poweredByHeader: false,
  outputFileTracingExcludes: {
    "/*": ["./docs/**/*", "./logs/**/*", "./next.config.mjs", "./test-results/**/*", "./tests/**/*", "./uploads/**/*"]
  }
};

export default nextConfig;
