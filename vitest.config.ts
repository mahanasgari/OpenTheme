import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      "tools/reference-checker",
      "tools/spec-lint",
      "conformance/runner",
      "packages/core",
      "packages/core-conformance",
      "packages/web",
    ],
  },
});
