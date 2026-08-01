import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { resolveAuthBaseURL } from "@/app/lib/auth-url";
import { createAuthDatabase } from "@/app/lib/db";

export const auth = betterAuth({
  appName: "PitstopIQ",
  baseURL: resolveAuthBaseURL(),
  database: createAuthDatabase(),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  // Must stay last in the plugin list so Set-Cookie headers propagate
  // when auth.api.* is called from Server Actions / Route Handlers.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
