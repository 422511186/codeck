/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  outputFileTracingExcludes: {
    "/*": ["./docs/**/*", "./logs/**/*", "./next.config.mjs", "./test-results/**/*", "./tests/**/*", "./uploads/**/*"]
  }
};

export default nextConfig;
