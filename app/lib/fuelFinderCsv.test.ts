import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  decryptFuelFinderNxhex,
  extractCsvPresign,
  getFuelFinderTransportSecret,
  parseCsvRecords,
  parseFuelFinderCsv,
} from "./fuelFinderCsv";

const HEADER =
  "forecourts.node_id,forecourts.trading_name,forecourts.brand_name,forecourts.temporary_closure,forecourts.permanent_closure,forecourts.permanent_closure_date,forecourts.location.address_line_1,forecourts.location.address_line_2,forecourts.location.city,forecourts.location.postcode,forecourts.location.latitude,forecourts.location.longitude,forecourts.fuel_price.E5,forecourts.price_submission_timestamp.E5,forecourts.fuel_price.E10,forecourts.price_submission_timestamp.E10,forecourts.fuel_price.B7S,forecourts.price_submission_timestamp.B7S,forecourts.fuel_price.B7P,forecourts.price_submission_timestamp.B7P,forecourts.fuel_price.HVO,forecourts.price_submission_timestamp.HVO";

describe("parseCsvRecords", () => {
  it("handles quoted fields, escaped quotes, and CR", () => {
    expect(parseCsvRecords('a,"b,c",d\n1,"2,3",4\n')).toEqual([
      ["a", "b,c", "d"],
      ["1", "2,3", "4"],
    ]);
    expect(parseCsvRecords('"say ""hi""",x\r\n')).toEqual([
      ['say "hi"', "x"],
    ]);
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

describe("parseFuelFinderCsv", () => {
  it("maps open and closed stations with E10/E5/B7 prices and closure flags", () => {
    const csv = `${HEADER}
abc123,PONTYPOOL SUPERSTORE,TESCO,false,false,,LOWER BRIDGE STREET,,PONTYPOOL,NP4 0XB,51.7000700,-3.0402500,,,154.9000,Fri Jul 31 2026 16:15:08 GMT+0000 (Coordinated Universal Time),135.9000,Fri Jul 31 2026 12:00:00 GMT+0000 (Coordinated Universal Time),145.9000,Fri Jul 31 2026 14:00:00 GMT+0000 (Coordinated Universal Time),167.9000,Fri Jul 31 2026 13:00:00 GMT+0000 (Coordinated Universal Time)
closed1,CLOSED SITE,GULF,true,false,,,,,OX15 6ER,51.96,-1.95,,,161.7000,Fri Jul 31 2026 14:36:15 GMT+0000 (Coordinated Universal Time),,,,,,
perm1,GONE,BP,false,yes,2026-03-01,,,,SW1A 1AA,51.5,-0.1,,,130.0,Fri Jul 31 2026 14:36:15 GMT+0000 (Coordinated Universal Time),,,,,,
quoted,"SHELL, READING",SHELL,false,false,,Vastern Road,,Reading,RG1 8EQ,51.45,-0.97,142.9000,Fri Jul 31 2026 14:36:15 GMT+0000 (Coordinated Universal Time),132.9000,Fri Jul 31 2026 14:36:15 GMT+0000 (Coordinated Universal Time),,,,,,
premiumOnly,PREMIUM ONLY,SHELL,false,false,,Bath Road,,Reading,RG2 0AA,51.44,-0.96,,,,,,,149.9000,Fri Jul 31 2026 12:00:00 GMT+0000 (Coordinated Universal Time),,
`;
    const stations = parseFuelFinderCsv(csv);
    expect(stations).toHaveLength(5);

    const tesco = stations.find((s) => s.id === "abc123");
    expect(tesco?.brand).toBe("TESCO");
    expect(tesco?.address).toBe("LOWER BRIDGE STREET, PONTYPOOL");
    expect(tesco?.postcode).toBe("NP4 0XB");
    expect(tesco?.temporaryClosure).toBe(false);
    expect(tesco?.permanentClosure).toBe(false);
    expect(tesco?.permanentClosureDate).toBeNull();
    expect(tesco?.prices.E10).toBe(1.549);
    expect(tesco?.prices.B7_Diesel).toBe(1.359);
    expect(tesco?.prices.B7_Premium).toBe(1.459);
    expect(tesco?.prices.HVO).toBe(1.679);
    expect(tesco?.pricesUpdatedAt?.E10).toBe(
      Date.parse("Fri Jul 31 2026 16:15:08 GMT+0000 (Coordinated Universal Time)")
    );
    expect(tesco?.pricesUpdatedAt?.B7_Diesel).toBe(
      Date.parse("Fri Jul 31 2026 12:00:00 GMT+0000 (Coordinated Universal Time)")
    );
    expect(tesco?.pricesUpdatedAt?.B7_Premium).toBe(
      Date.parse("Fri Jul 31 2026 14:00:00 GMT+0000 (Coordinated Universal Time)")
    );
    expect(tesco?.pricesUpdatedAt?.HVO).toBe(
      Date.parse("Fri Jul 31 2026 13:00:00 GMT+0000 (Coordinated Universal Time)")
    );
    expect(tesco?.pricesLastUpdatedAt).toBe(
      Date.parse("Fri Jul 31 2026 16:15:08 GMT+0000 (Coordinated Universal Time)")
    );

    const shell = stations.find((s) => s.id === "quoted");
    expect(shell?.name).toBe("SHELL, READING");
    expect(shell?.address).toBe("Vastern Road, Reading");
    expect(shell?.postcode).toBe("RG1 8EQ");
    expect(shell?.prices.E5).toBe(1.429);
    expect(shell?.prices.E10).toBe(1.329);

    const premiumOnly = stations.find((s) => s.id === "premiumOnly");
    expect(premiumOnly?.prices.B7_Premium).toBe(1.499);
    expect(premiumOnly?.prices.B7_Diesel).toBeUndefined();

    const closed = stations.find((s) => s.id === "closed1");
    expect(closed?.temporaryClosure).toBe(true);
    expect(closed?.permanentClosure).toBe(false);
    expect(closed?.prices.E10).toBe(1.617);

    const perm = stations.find((s) => s.id === "perm1");
    expect(perm?.temporaryClosure).toBe(false);
    expect(perm?.permanentClosure).toBe(true);
    expect(perm?.permanentClosureDate).toBe("2026-03-01");
  });

  it("skips malformed or priceless open rows and applies name fallbacks", () => {
    const csv = `${HEADER}
,No Id,X,false,false,,,,,,51.5,-0.1,,,130.0,,
badcoords,X,Y,false,false,,,,,,not-a-lat,-0.1,,,130.0,,
noprices,Brand Only,,false,false,,,,,,51.5,-0.1,,,,,,
brandless,,Only Brand,false,false,,,,,RG1 1AA,51.5,-0.1,,,130.0,,
nameless,,,false,false,,,,,,51.5,-0.1,1.329,,,
flag1,ONE,GULF,false,1,2025-12-01,,,,,51.5,-0.1,,,130.0,,
closedNoPrice,SHUT,BP,false,true,2026-01-15,,,,,51.5,-0.1,,,,,,

`;
    const stations = parseFuelFinderCsv(csv, { lat: 51.5, lng: -0.1 });
    expect(stations).toHaveLength(4);
    expect(stations.find((s) => s.id === "noprices")).toBeUndefined();
    const flag1 = stations.find((s) => s.id === "flag1");
    expect(flag1?.permanentClosure).toBe(true);
    expect(flag1?.permanentClosureDate).toBe("2025-12-01");
    const closedNoPrice = stations.find((s) => s.id === "closedNoPrice");
    expect(closedNoPrice?.permanentClosure).toBe(true);
    expect(closedNoPrice?.prices).toEqual({});
    expect(stations.find((s) => s.id === "brandless")?.name).toBe("Only Brand");
    expect(stations.find((s) => s.id === "brandless")?.brand).toBe("Only Brand");
    expect(stations.find((s) => s.id === "brandless")?.postcode).toBe("RG1 1AA");
    expect(stations.find((s) => s.id === "nameless")?.name).toBe("Forecourt");
    expect(stations.find((s) => s.id === "nameless")?.brand).toBe("Unknown");
    expect(stations.find((s) => s.id === "nameless")?.postcode).toBeNull();
    expect(stations.find((s) => s.id === "nameless")?.pricesLastUpdatedAt).toBeNull();
  });

  it("skips empty CSV rows and missing header columns", () => {
    const csv = `forecourts.node_id,forecourts.location.latitude,forecourts.location.longitude,forecourts.fuel_price.E10

solo,x,y,130.0
ok,51.5,-0.1,140.0
`;
    const stations = parseFuelFinderCsv(csv);
    expect(stations).toHaveLength(1);
    expect(stations[0].id).toBe("ok");
    expect(stations[0].name).toBe("Forecourt");
  });

  it("returns an empty list for blank or header-only CSV", () => {
    expect(parseFuelFinderCsv("")).toEqual([]);
    expect(parseFuelFinderCsv("a,b\n")).toEqual([]);
  });
});

describe("getFuelFinderTransportSecret", () => {
  afterEach(() => {
    delete process.env.FUEL_FINDER_TRANSPORT_SECRET;
  });

  it("returns the trimmed env value when set", () => {
    process.env.FUEL_FINDER_TRANSPORT_SECRET = " custom-secret ";
    expect(getFuelFinderTransportSecret()).toBe("custom-secret");
  });

  it("throws when the env var is missing", () => {
    delete process.env.FUEL_FINDER_TRANSPORT_SECRET;
    expect(() => getFuelFinderTransportSecret()).toThrow(
      /FUEL_FINDER_TRANSPORT_SECRET/
    );
  });
});

describe("decryptFuelFinderNxhex + extractCsvPresign", () => {
  const testSecret = "unit-test-transport-secret-not-for-production";

  afterEach(() => {
    delete process.env.FUEL_FINDER_TRANSPORT_SECRET;
  });

  it("round-trips the portal AES envelope and extracts redirectUrl", () => {
    process.env.FUEL_FINDER_TRANSPORT_SECRET = testSecret;
    const key = createHash("sha256").update(testSecret).digest();
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

  it("rejects invalid or incomplete presign payloads", () => {
    expect(extractCsvPresign(null)).toBeNull();
    expect(extractCsvPresign("nope")).toBeNull();
    expect(extractCsvPresign({ success: true, data: {} })).toBeNull();
    expect(
      extractCsvPresign({
        data: { redirectUrl: "  https://example.com/a.csv  " },
      })
    ).toEqual({
      redirectUrl: "https://example.com/a.csv",
      generatedAt: null,
    });
  });
});
