import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/index.ts"],
    // The stylesheet is published next to the bundle (`./style.css` in `publishConfig.exports`).
    copy: ["src/style.css"],
    dts: {
      generator: "tsgo",
    },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "happy-dom",
    passWithNoTests: false,
    allowOnly: false,
    testTimeout: 5000,
  },
});
