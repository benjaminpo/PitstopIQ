import { createAuthClient } from "better-auth/react";

// baseURL defaults to the current origin, which is correct for
// both local dev and the deployed site.
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
