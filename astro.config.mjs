import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://matrdreams.com",
  output: "static",
  trailingSlash: "always",
  compressHTML: true,
});
