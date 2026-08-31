import { defineConfig } from "@playwright/test";

// Smoke tests run against the PRODUCTION build (vite preview) in demo mode —
// this catches minified-only crashes (like the React #310 class of bugs)
// that never appear on the dev server.
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://localhost:4173",
    trace: "retain-on-failure",
    // Use the installed Chrome locally (no browser download); CI installs chromium.
    channel: process.env.CI ? undefined : "chrome",
  },
  webServer: {
    command: "pnpm build && pnpm serve --port 4173 --strictPort",
    url: "http://localhost:4173",
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
    // Demo mode: make sure no local Supabase env leaks into the build.
    env: { VITE_SUPABASE_URL: "", VITE_SUPABASE_ANON_KEY: "" },
  },
});
