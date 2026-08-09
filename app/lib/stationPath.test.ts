import { describe, expect, it } from "vitest";
import {
  findStationByPathKey,
  slugifyStationName,
  stationHref,
  stationKeyMatchesId,
  stationPathKey,
} from "./stationPath";

describe("slugifyStationName", () => {
  it("slugifies names for SEO URLs", () => {
    expect(slugifyStationName("Tesco Extra Slough")).toBe("tesco-extra-slough");
    expect(slugifyStationName("Sainsbury's Windsor")).toBe("sainsburys-windsor");
    expect(slugifyStationName("  Moto — Reading  ")).toBe("moto-reading");
  });

  it("falls back when empty", () => {
    expect(slugifyStationName("")).toBe("station");
    expect(slugifyStationName("!!!")).toBe("station");
  });
});

describe("stationPathKey / stationHref", () => {
  it("builds id-slug keys and hrefs", () => {
    const station = { id: "mock-tesco-slough", name: "Tesco Extra Slough" };
    expect(stationPathKey(station)).toBe(
      "mock-tesco-slough-tesco-extra-slough"
    );
    expect(stationHref(station)).toBe(
      "/stations/mock-tesco-slough-tesco-extra-slough"
    );
  });
});

describe("stationKeyMatchesId / findStationByPathKey", () => {
  it("matches exact id and id-with-slug", () => {
    expect(stationKeyMatchesId("abc", "abc")).toBe(true);
    expect(stationKeyMatchesId("abc-tesco", "abc")).toBe(true);
    expect(stationKeyMatchesId("abcd", "abc")).toBe(false);
  });

  it("prefers the longest matching id", () => {
    const stations = [
      { id: "mock" },
      { id: "mock-tesco-slough" },
    ];
    expect(
      findStationByPathKey(stations, "mock-tesco-slough-tesco-extra-slough")?.id
    ).toBe("mock-tesco-slough");
  });

  it("decodes URI-encoded keys", () => {
    const stations = [{ id: "hex64id" }];
    expect(
      findStationByPathKey(stations, "hex64id-shell%20west")?.id
    ).toBe("hex64id");
  });
});
