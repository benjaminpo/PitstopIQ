import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const points = [
  { lat: 51.5, lng: -0.12 },
  { lat: 51.51, lng: -0.13 },
];
const noAvoid = { motorways: false, tolls: false, ferries: false };

async function loadRouting() {
  vi.stubEnv("OSRM_BASE_URL", "https://router.project-osrm.org/");
  vi.stubEnv("VALHALLA_BASE_URL", "https://valhalla.example/");
  vi.resetModules();
  return import("./serverRouting");
}

describe("server routing", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("resolves an OSRM route with geometry", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({
        code: "Ok",
        routes: [
          {
            distance: 1609.344,
            duration: 90.4,
            geometry: {
              coordinates: [
                [-0.12, 51.5],
                [-0.13, 51.51],
              ],
            },
          },
        ],
      })
    );
    const { resolveDrivingRoute } = await loadRouting();

    const route = await resolveDrivingRoute(points);

    expect(route).toMatchObject({
      distanceMiles: 1,
      durationSeconds: 90,
      coordinates: points,
    });
    expect(route?.bounds).toMatchObject({
      north: expect.any(Number),
      south: expect.any(Number),
      east: expect.any(Number),
      west: expect.any(Number),
    });
    expect(route!.bounds.north).toBeGreaterThan(51.51);
    expect(route!.bounds.south).toBeLessThan(51.5);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("overview=full"),
      expect.objectContaining({
        cache: "no-store",
        signal: expect.any(AbortSignal),
      })
    );
  });

  it("returns lightweight OSRM leg metrics without geometry", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({
        code: "Ok",
        routes: [{ distance: 2500, duration: 180 }],
      })
    );
    const { resolveRouteLeg } = await loadRouting();

    await expect(resolveRouteLeg(points, noAvoid)).resolves.toEqual({
      distanceMeters: 2500,
      durationSeconds: 180,
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("overview=false"),
      expect.objectContaining({
        cache: "no-store",
        signal: expect.any(AbortSignal),
      })
    );
  });

  it("resolves all OSRM matrix cells in one request", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({
        code: "Ok",
        distances: [
          [0, 2500],
          [2400, 0],
        ],
        durations: [
          [0, 180],
          [175, 0],
        ],
      })
    );
    const { resolveRouteMatrix } = await loadRouting();

    await expect(resolveRouteMatrix(points, noAvoid)).resolves.toEqual({
      distanceMeters: [
        [0, 2500],
        [2400, 0],
      ],
      durationSeconds: [
        [0, 180],
        [175, 0],
      ],
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toContain(
      "/table/v1/driving/"
    );
  });

  it("uses one Valhalla matrix request when avoid options are active", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({
        sources_to_targets: [
          [
            { from_index: 0, to_index: 0, distance: 0, time: 0 },
            { from_index: 0, to_index: 1, distance: 2.5, time: 180 },
          ],
          [
            { from_index: 1, to_index: 0, distance: 2.4, time: 175 },
            { from_index: 1, to_index: 1, distance: 0, time: 0 },
          ],
        ],
      })
    );
    const { resolveRouteMatrix } = await loadRouting();

    const matrix = await resolveRouteMatrix(points, {
      motorways: false,
      tolls: true,
      ferries: false,
    });

    expect(matrix?.distanceMeters[0][1]).toBe(2500);
    expect(matrix?.durationSeconds[1][0]).toBe(175);
    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(url).toBe("https://valhalla.example/sources_to_targets");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      costing_options: { auto: { use_tolls: 0 } },
    });
  });

  it("uses Valhalla for avoid options unsupported by public OSRM", async () => {
    const firstShape = encodePolyline(points);
    const continuation = encodePolyline([points[1], { lat: 51.52, lng: -0.14 }]);
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({
        trip: {
          summary: { length: 3.2, time: 240.2 },
          legs: [{ shape: firstShape }, { shape: continuation }, { shape: "" }],
        },
      })
    );
    const { resolveDrivingRoute } = await loadRouting();

    const route = await resolveDrivingRoute(points, {
      motorways: true,
      tolls: true,
      ferries: true,
    });

    expect(route?.distanceMiles).toBeCloseTo(1.99, 2);
    expect(route?.durationSeconds).toBe(240);
    expect(route?.coordinates).toHaveLength(3);
    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(url).toBe("https://valhalla.example/route");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      costing_options: {
        auto: { use_highways: 0, use_tolls: 0, use_ferry: 0 },
      },
    });
  });

  it("falls back to Valhalla and can omit geometry", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(
        Response.json({
          trip: {
            summary: { length: 2, time: 120 },
            legs: [{ shape: "" }],
          },
        })
      );
    const { resolveDrivingRoute } = await loadRouting();

    const route = await resolveDrivingRoute(points, noAvoid, {
      geometry: false,
    });

    expect(route?.coordinates).toEqual([]);
    expect(route?.distanceMiles).toBeCloseTo(1.24, 2);
    const body = JSON.parse(
      String(vi.mocked(fetch).mock.calls[1]?.[1]?.body)
    ) as Record<string, unknown>;
    expect(body.directions_type).toBe("none");
  });

  it("returns a zero-length route for coincident waypoints without fetching", async () => {
    const { resolveDrivingRoute, resolveRouteLeg } = await loadRouting();
    const same = [
      { lat: 51.3538, lng: -0.19814 },
      { lat: 51.3538, lng: -0.19814 },
    ];
    await expect(
      resolveDrivingRoute(same, { motorways: false, tolls: true, ferries: false })
    ).resolves.toMatchObject({
      distanceMiles: 0,
      durationSeconds: 0,
      coordinates: [same[0]],
    });
    await expect(resolveRouteLeg(same, noAvoid)).resolves.toEqual({
      distanceMeters: 0,
      durationSeconds: 0,
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns null for too few points or failed providers", async () => {
    const { resolveDrivingRoute, resolveRouteLeg } = await loadRouting();
    await expect(resolveDrivingRoute([points[0]])).resolves.toBeNull();
    expect(fetch).not.toHaveBeenCalled();

    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json({ code: "NoRoute" }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }));
    await expect(resolveRouteLeg(points, noAvoid)).resolves.toBeNull();
  });

  it("probes Valhalla /status for planner health", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 200 }));
    const { probeValhallaHealth } = await loadRouting();
    await expect(probeValhallaHealth()).resolves.toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      "https://valhalla.example/status",
      expect.objectContaining({
        cache: "no-store",
        signal: expect.any(AbortSignal),
      })
    );
  });

  it("treats a Valhalla probe timeout as down", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("timeout"));
    const { probeValhallaHealth } = await loadRouting();
    await expect(probeValhallaHealth()).resolves.toBe(false);
  });
});

function encodePolyline(
  input: Array<{ lat: number; lng: number }>,
  precision = 1e6
): string {
  let previousLat = 0;
  let previousLng = 0;
  let output = "";

  const encodeSigned = (value: number) => {
    let encoded = value < 0 ? ~(value << 1) : value << 1;
    while (encoded >= 0x20) {
      output += String.fromCharCode((0x20 | (encoded & 0x1f)) + 63);
      encoded >>= 5;
    }
    output += String.fromCharCode(encoded + 63);
  };

  for (const point of input) {
    const lat = Math.round(point.lat * precision);
    const lng = Math.round(point.lng * precision);
    encodeSigned(lat - previousLat);
    encodeSigned(lng - previousLng);
    previousLat = lat;
    previousLng = lng;
  }
  return output;
}
