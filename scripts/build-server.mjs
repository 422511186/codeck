import { build } from "esbuild";

await build({
  entryPoints: ["src/server/http.ts"],
  outfile: "dist/server/http.js",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  packages: "external",
  sourcemap: true,
  logLevel: "info",
  banner: {
    js: [
      "import { createRequire as __codexWebCreateRequire } from 'node:module';",
      "const require = __codexWebCreateRequire(import.meta.url);"
    ].join("\n")
  }
});
