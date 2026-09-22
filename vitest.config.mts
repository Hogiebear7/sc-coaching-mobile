import path from "node:path";

import { defineConfig } from "vitest/config";

// Deliberately minimal — no jsdom, no React Native mocks, no plugins. This
// project has no component-level test runner; this config exists only to
// run plain-TypeScript pure-function tests (src/lib/**/__tests__), the same
// scope as gym-app's own Vitest setup. See src/lib/community-formatters.ts
// for why those functions are safe to test this way (no RN/navigation/API
// imports).
export default defineConfig({
  test: {
    include: ["src/**/__tests__/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
});
