import { describe, expect, it } from "vitest";
import { isPastLastFuelFinderBatch } from "./fuelFinderClient";

describe("isPastLastFuelFinderBatch", () => {
  it("detects Fuel Finder's end-of-pagination 404", () => {
    expect(
      isPastLastFuelFinderBatch(
        404,
        JSON.stringify({
          success: false,
          data: { message: "Requested batch 17 is not available" },
        })
      )
    ).toBe(true);
  });

  it("ignores other failures", () => {
    expect(isPastLastFuelFinderBatch(500, "Requested batch 17 is not available")).toBe(
      false
    );
    expect(isPastLastFuelFinderBatch(404, "Not Found")).toBe(false);
    expect(isPastLastFuelFinderBatch(404, "")).toBe(false);
  });
});
