import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/index.ts"],
    dts: {
      generator: "tsgo",
    },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    passWithNoTests: false,
    allowOnly: false,
    testTimeout: 5000,
  },
});
