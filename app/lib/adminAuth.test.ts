import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();

vi.mock("@/app/lib/auth", () => ({
  auth: {
    api: {
      getSession,
    },
  },
}));

describe("adminAuth", () => {
  beforeEach(() => {
    vi.resetModules();
    getSession.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("isAdminEmail matches configured emails case-insensitively", async () => {
    vi.stubEnv("ADMIN_EMAILS", " Admin@Example.com ,other@test.com ");
    const { isAdminEmail } = await import("./adminAuth");
    expect(isAdminEmail("admin@example.com")).toBe(true);
    expect(isAdminEmail("OTHER@TEST.COM")).toBe(true);
    expect(isAdminEmail("nope@test.com")).toBe(false);
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail("")).toBe(false);
  });

  it("getAdminSession returns session only for admin users", async () => {
    vi.stubEnv("ADMIN_EMAILS", "admin@example.com");
    const { getAdminSession } = await import("./adminAuth");

    getSession.mockResolvedValueOnce({
      user: { email: "admin@example.com" },
    });
    await expect(getAdminSession(new Headers())).resolves.toEqual({
      user: { email: "admin@example.com" },
    });

    getSession.mockResolvedValueOnce({
      user: { email: "user@example.com" },
    });
    await expect(getAdminSession(new Headers())).resolves.toBeNull();

    getSession.mockResolvedValueOnce(null);
    await expect(getAdminSession(new Headers())).resolves.toBeNull();
  });
});
