import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TEST_DATABASE_URL } from "./vitest.shared";

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(here, "src"),
    },
  },
  test: {
    environment: "node",
    globalSetup: ["./vitest.global-setup.ts"],
    // Every suite runs against the same real test database and truncates it
    // between tests, so files must not run in parallel (they would truncate
    // each other's fixtures mid-test).
    fileParallelism: false,
    env: {
      TEST_DATABASE_URL,
      // The app reads DATABASE_URL; point it at the test database.
      DATABASE_URL: TEST_DATABASE_URL,
    },
  },
});
