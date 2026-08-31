import { defineConfig } from "vitest/config";

// Standalone config (does not load vite.config.ts) so unit tests skip the
// Tailwind/React plugins entirely — they only test pure TS in src/lib.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // Force demo mode: with a real .env.local present the data-source
    // would otherwise pick the LIVE Supabase adapter and unit tests would
    // query the production database (same guard as the e2e webServer env).
    env: {
      VITE_SUPABASE_URL: "",
      VITE_SUPABASE_ANON_KEY: "",
    },
  },
});
