import { describe, expect, it } from "vitest";
import { parseCsvRecords } from "./csvRecords";

describe("parseCsvRecords", () => {
  it("handles quoted fields, escaped quotes, and CR", () => {
    expect(parseCsvRecords('a,"b,c",d\n1,"2,3",4\n')).toEqual([
      ["a", "b,c", "d"],
      ["1", "2,3", "4"],
    ]);
    expect(parseCsvRecords('"say ""hi""",x\r\n')).toEqual([['say "hi"', "x"]]);
  });

  it("keeps a final row when the file has no trailing newline", () => {
    expect(parseCsvRecords("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("drops a trailing empty record from a blank final line", () => {
    expect(parseCsvRecords("a,b\n1,2\n\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});
