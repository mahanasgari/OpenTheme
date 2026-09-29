import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    include: ["test/**/*.test.ts"],
    setupFiles: ["../web/test/setup.ts"],
    testTimeout: 60_000,
  },
});
