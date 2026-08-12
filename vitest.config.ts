import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next"],
    setupFiles: ["./test/setup-env.ts"],
    // Integration tests hit a real local Supabase instance and create/drop
    // several test users via the Auth Admin API — keep them from racing each
    // other or the fixture files they share.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // "server-only" throws when imported outside Next.js's react-server
      // condition (by design, to fail builds that leak it into the client
      // bundle) — under plain Node/Vitest that condition never applies, so
      // it would throw on every import. Stub it to a no-op for unit tests.
      "server-only": path.resolve(__dirname, "test/stubs/server-only.ts"),
    },
  },
});
