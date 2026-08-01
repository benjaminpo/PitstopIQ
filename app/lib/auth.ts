import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { createAuthDatabase } from "@/app/lib/db";

export const auth = betterAuth({
  appName: "PitstopIQ",
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
