/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingExcludes: {
    "/*": ["./docs/**/*", "./logs/**/*", "./next.config.mjs", "./test-results/**/*", "./tests/**/*", "./uploads/**/*"]
  },
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  devIndicators: false
};

export default nextConfig;
