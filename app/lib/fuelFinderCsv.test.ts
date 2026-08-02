import { describe, expect, it } from "vitest";
import {
  decryptFuelFinderNxhex,
  extractCsvPresign,
  parseCsvRecords,
  parseFuelFinderCsv,
} from "./fuelFinderCsv";
import { createCipheriv, createHash, randomBytes } from "node:crypto";

const SAMPLE_CSV = `forecourt_update_timestamp,forecourts.node_id,forecourts.trading_name,forecourts.brand_name,forecourts.is_motorway_service_station,forecourts.is_supermarket_service_station,forecourts.public_phone_number,forecourts.temporary_closure,forecourts.permanent_closure,forecourts.permanent_closure_date,forecourts.location.postcode,forecourts.location.address_line_1,forecourts.location.address_line_2,forecourts.location.city,forecourts.location.county,forecourts.location.country,forecourts.location.latitude,forecourts.location.longitude,forecourts.fuel_price.E5,forecourts.price_submission_timestamp.E5,forecourts.price_change_effective_timestamp.E5,forecourts.fuel_price.E10,forecourts.price_submission_timestamp.E10,forecourts.price_change_effective_timestamp.E10,forecourts.fuel_price.B7S,forecourts.price_submission_timestamp.B7S,forecourts.price_change_effective_timestamp.B7S,forecourts.fuel_price.B7P,forecourts.price_submission_timestamp.B7P,forecourts.price_change_effective_timestamp.B7P,forecourts.fuel_price.B10,forecourts.price_submission_timestamp.B10,forecourts.price_change_effective_timestamp.B10,forecourts.fuel_price.HVO,forecourts.price_submission_timestamp.HVO,forecourts.price_change_effective_timestamp.HVO
Fri Jul 31 2026 16:10:16 GMT+0000 (Coordinated Universal Time),abc123,PONTYPOOL SUPERSTORE,TESCO,false,true,+44800,false,false,,NP4 6JU,LOWER BRIDGE STREET,,PONTYPOOL,,WALES,51.7000700,-3.0402500,,,,154.9000,Fri Jul 31 2026 16:15:08 GMT+0000 (Coordinated Universal Time),Fri Jul 31 2026 16:10:16 GMT+0000 (Coordinated Universal Time),135.9000,Fri Jul 31 2026 16:15:08 GMT+0000 (Coordinated Universal Time),Fri Jul 31 2026 16:10:16 GMT+0000 (Coordinated Universal Time),,,,,,,,,,,
Fri Jul 31 2026 14:36:15 GMT+0000 (Coordinated Universal Time),closed1,CLOSED SITE,GULF,false,false,,true,false,,GL54 5NT,ROAD,,TOWN,,ENGLAND,51.96,-1.95,,,,161.7000,Fri Jul 31 2026 14:36:15 GMT+0000 (Coordinated Universal Time),Fri Jul 31 2026 14:36:15 GMT+0000 (Coordinated Universal Time),,,,,,,,,,,,,
Fri Jul 31 2026 14:36:15 GMT+0000 (Coordinated Universal Time),quoted,"SHELL, READING",SHELL,false,false,,false,false,,RG1 1AA,"HIGH STREET, WEST",,READING,,ENGLAND,51.45,-0.97,142.9000,Fri Jul 31 2026 14:36:15 GMT+0000 (Coordinated Universal Time),Fri Jul 31 2026 14:36:15 GMT+0000 (Coordinated Universal Time),132.9000,Fri Jul 31 2026 14:36:15 GMT+0000 (Coordinated Universal Time),Fri Jul 31 2026 14:36:15 GMT+0000 (Coordinated Universal Time),,,,,,,,,,,,,
`;

describe("parseCsvRecords", () => {
  it("handles quoted fields with commas", () => {
    const rows = parseCsvRecords('a,"b,c",d\n1,"2,3",4\n');
    expect(rows).toEqual([
      ["a", "b,c", "d"],
      ["1", "2,3", "4"],
    ]);
  });
});

describe("parseFuelFinderCsv", () => {
  it("maps open stations with E10/E5/B7 prices and skips closures", () => {
    const stations = parseFuelFinderCsv(SAMPLE_CSV);
    expect(stations).toHaveLength(2);

    const tesco = stations.find((s) => s.id === "abc123");
    expect(tesco?.brand).toBe("TESCO");
    expect(tesco?.prices.E10).toBe(1.549);
    expect(tesco?.prices.B7_Diesel).toBe(1.359);
    expect(tesco?.pricesLastUpdatedAt).toBe(
      Date.parse("Fri Jul 31 2026 16:15:08 GMT+0000 (Coordinated Universal Time)")
    );

    const shell = stations.find((s) => s.id === "quoted");
    expect(shell?.name).toBe("SHELL, READING");
    expect(shell?.prices.E5).toBe(1.429);
    expect(shell?.prices.E10).toBe(1.329);

    expect(stations.some((s) => s.id === "closed1")).toBe(false);
  });
});

describe("decryptFuelFinderNxhex + extractCsvPresign", () => {
  it("round-trips the portal AES envelope and extracts redirectUrl", () => {
    const secret =
      "wAndRKxKefFpcuAMQyObcik5zkthu80KcrvK7av3oXCUeyjm3HyzZUuFvR9UN97Kd6jGJANMU9K3TITw1dCPLc";
    const key = createHash("sha256").update(secret).digest();
    const iv = randomBytes(16);
    const cipher = createCipheriv("aes-256-cbc", key, iv);
    const payload = {
      success: true,
      data: {
        redirectUrl: "https://example.com/prices.csv",
        generated_at: "2026-08-02T09:00:19.495Z",
      },
    };
    let nxhex = cipher.update(JSON.stringify(payload), "utf8", "hex");
    nxhex += cipher.final("hex");

    const decrypted = decryptFuelFinderNxhex({
      nxhex,
      iv: iv.toString("hex"),
    });
    expect(extractCsvPresign(decrypted)).toEqual({
      redirectUrl: "https://example.com/prices.csv",
      generatedAt: "2026-08-02T09:00:19.495Z",
    });
  });
});
