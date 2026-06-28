/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  devIndicators: false,
  poweredByHeader: false,
  outputFileTracingExcludes: {
    "/*": ["./docs/**/*", "./logs/**/*", "./next.config.mjs", "./test-results/**/*", "./tests/**/*", "./uploads/**/*"]
  }
};

export default nextConfig;
