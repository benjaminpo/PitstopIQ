import { afterEach, describe, expect, it, vi } from "vitest";
import {
  VALHALLA_AVOID_DOWN_MESSAGE,
  VALHALLA_AVOID_OK_MESSAGE,
  avoidRoutingNotice,
  fetchValhallaHealth,
  resetValhallaHealthCache,
} from "./valhallaHealth";

describe("avoidRoutingNotice", () => {
  it("stays quiet until Avoid is on and the probe has finished", () => {
    expect(avoidRoutingNotice("unknown", true)).toBeNull();
    expect(avoidRoutingNotice("ok", false)).toBeNull();
    expect(avoidRoutingNotice("down", false)).toBeNull();
  });

  it("confirms Valhalla when Avoid is on and the probe succeeded", () => {
    expect(avoidRoutingNotice("ok", true)).toEqual({
      tone: "ok",
      text: VALHALLA_AVOID_OK_MESSAGE,
    });
  });

  it("warns when Avoid is on but Valhalla is down", () => {
    expect(avoidRoutingNotice("down", true)).toEqual({
      tone: "warn",
      text: VALHALLA_AVOID_DOWN_MESSAGE,
    });
  });
});

describe("fetchValhallaHealth", () => {
  afterEach(() => {
    resetValhallaHealthCache();
    vi.unstubAllGlobals();
  });

  it("caches a successful probe", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchValhallaHealth()).resolves.toBe("ok");
    await expect(fetchValhallaHealth()).resolves.toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("treats a failed probe as down", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: false }),
      })
    );
    await expect(fetchValhallaHealth()).resolves.toBe("down");
  });
});
