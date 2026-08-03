import { describe, expect, it } from "vitest";
import { joinDisplayName, splitDisplayName } from "@/app/lib/userName";

describe("splitDisplayName", () => {
  it("splits on the first space", () => {
    expect(splitDisplayName("Alex Driver")).toEqual({
      firstName: "Alex",
      lastName: "Driver",
    });
  });

  it("keeps extra words in last name", () => {
    expect(splitDisplayName("Mary Ann Smith")).toEqual({
      firstName: "Mary",
      lastName: "Ann Smith",
    });
  });

  it("handles a single word", () => {
    expect(splitDisplayName("Alex")).toEqual({
      firstName: "Alex",
      lastName: "",
    });
  });

  it("handles blank and nullish", () => {
    expect(splitDisplayName("")).toEqual({ firstName: "", lastName: "" });
    expect(splitDisplayName("   ")).toEqual({ firstName: "", lastName: "" });
    expect(splitDisplayName(null)).toEqual({ firstName: "", lastName: "" });
    expect(splitDisplayName(undefined)).toEqual({
      firstName: "",
      lastName: "",
    });
  });
});

describe("joinDisplayName", () => {
  it("joins first and last", () => {
    expect(joinDisplayName("Alex", "Driver")).toBe("Alex Driver");
  });

  it("omits blank parts", () => {
    expect(joinDisplayName("Alex", "")).toBe("Alex");
    expect(joinDisplayName("", "Driver")).toBe("Driver");
    expect(joinDisplayName("  ", "  ")).toBe("");
  });

  it("trims whitespace", () => {
    expect(joinDisplayName("  Alex ", " Driver  ")).toBe("Alex Driver");
  });
});
