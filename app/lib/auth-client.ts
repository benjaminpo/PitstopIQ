import { createAuthClient } from "better-auth/react";
import { resolveAuthBaseURL } from "@/app/lib/auth-url";

// Pass an explicit absolute URL so Better Auth does not read a blank/invalid
// BETTER_AUTH_URL from `vercel pull` during CI/SSR prerender of /login.
export const authClient = createAuthClient({
  baseURL: resolveAuthBaseURL(),
});

export const { signIn, signUp, signOut, useSession, updateUser } = authClient;
