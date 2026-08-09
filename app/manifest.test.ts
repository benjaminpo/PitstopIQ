import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
} from "@/app/lib/site";

describe("manifest", () => {
  it("returns PWA metadata for the site", () => {
    expect(manifest()).toMatchObject({
      name: `${SITE_NAME} — ${SITE_TAGLINE}`,
      short_name: SITE_NAME,
      description: SITE_DESCRIPTION,
      start_url: "/",
      display: "standalone",
      lang: "en-GB",
    });
    expect(manifest().icons?.length).toBeGreaterThan(0);
  });
});
