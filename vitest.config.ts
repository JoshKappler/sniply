import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  // Explicit alias as well as the tsconfig-paths plugin: vitest resolves
  // bare "@/..." imports through Node ESM in some environments, which
  // bypasses the plugin and fails with "Cannot find package '@/...'".
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    // Vitest's default glob also matches the Playwright e2e .spec.ts files,
    // which crash under vitest ("test.beforeAll() called outside Playwright").
    // Those run via `npm run test:e2e`; keep vitest on its own suites.
    include: ["tests/**/*.test.{ts,tsx}"],
    exclude: ["tests/e2e/**", "node_modules/**"],
    // environmentMatchGlobs was removed in vitest 4 — jsdom suites
    // (tests/components/*, tests/unit/auth-client.test.ts) opt in via a
    // per-file `// @vitest-environment jsdom` pragma instead.
    //
    // Node >= 22 ships an experimental `localStorage` global that is inert
    // unless --localstorage-file is set, and it shadows jsdom's working
    // Storage in jsdom suites ("localStorage.clear is not a function").
    // Disable it in the test workers so jsdom provides the real thing.
    execArgv: ["--no-experimental-webstorage"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/app/api/**"],
    },
  },
});
