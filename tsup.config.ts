import { defineConfig } from "tsup";

// noinspection JSUnusedGlobalSymbols
export default defineConfig({
  clean: true,
  dts: true,
  entry: ["src/index.ts"],
  format: ["esm"],
  sourcemap: true,
  splitting: false,
  target: "es2024",
});
