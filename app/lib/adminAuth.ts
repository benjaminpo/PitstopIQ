import { auth } from "@/app/lib/auth";

function configuredAdminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return configuredAdminEmails().has(email.trim().toLowerCase());
}

export async function getAdminSession(headers: Headers) {
  const session = await auth.api.getSession({ headers });
  return session?.user && isAdminEmail(session.user.email) ? session : null;
}
