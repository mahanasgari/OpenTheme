import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    include: ["test/**/*.test.ts"],
    passWithNoTests: true,
    testTimeout: 60_000,
  },
});
