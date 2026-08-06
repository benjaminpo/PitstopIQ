import { describe, expect, it } from "vitest";
import { formatStationAddress } from "./stationAddress";

describe("formatStationAddress", () => {
  it("joins street and city", () => {
    expect(
      formatStationAddress({
        addressLine1: "Lower Bridge Street",
        city: "Pontypool",
      })
    ).toBe("Lower Bridge Street, Pontypool");
  });

  it("includes address line 2 when present", () => {
    expect(
      formatStationAddress({
        addressLine1: "Unit 1",
        addressLine2: "Retail Park",
        city: "Reading",
      })
    ).toBe("Unit 1, Retail Park, Reading");
  });

  it("returns null when every part is blank", () => {
    expect(formatStationAddress({})).toBeNull();
    expect(
      formatStationAddress({ addressLine1: "  ", city: null })
    ).toBeNull();
  });
});
