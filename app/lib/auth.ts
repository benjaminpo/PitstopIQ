import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { Pool } from "pg";

/**
 * Postgres when DATABASE_URL is set (Neon / Vercel production).
 * Local SQLite otherwise — better-sqlite3 is required lazily so the
 * production serverless bundle never loads the native binding.
 */
function createDatabase() {
  const url = process.env.DATABASE_URL;
  if (url) {
    return new Pool({ connectionString: url });
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3") as typeof import("better-sqlite3");
  return new Database("pitstopiq.db");
}

export const auth = betterAuth({
  appName: "PitstopIQ",
  database: createDatabase(),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  // Must stay last in the plugin list so Set-Cookie headers propagate
  // when auth.api.* is called from Server Actions / Route Handlers.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
