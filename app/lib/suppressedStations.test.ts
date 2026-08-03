import { describe, expect, it } from "vitest";
import {
  isSuppressedStationId,
  withoutSuppressedStations,
} from "./suppressedStations";

describe("suppressedStations", () => {
  const closedHarvest =
    "c086c59f3ee206d895373cab7bb592e608921b1729df3802b8c58735395ac2a8";

  it("flags the known-closed Harvest Energy Classic (AL2 3RS)", () => {
    expect(isSuppressedStationId(closedHarvest)).toBe(true);
    expect(isSuppressedStationId("some-other-node")).toBe(false);
  });

  it("filters suppressed ids from a station list", () => {
    const stations = [
      { id: closedHarvest, name: "HARVEST ENERGY CLASSIC" },
      { id: "open-shell", name: "Shell" },
    ];
    expect(withoutSuppressedStations(stations)).toEqual([
      { id: "open-shell", name: "Shell" },
    ]);
  });
});
