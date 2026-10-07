import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    include: ["test/**/*.test.ts?(x)"],
    setupFiles: ["../web/test/setup.ts"],
    passWithNoTests: true,
    testTimeout: 60_000,
  },
});
