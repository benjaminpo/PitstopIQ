import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE } from "@/app/lib/site";

export const runtime = "edge";
export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px",
          background:
            "radial-gradient(ellipse at 20% 0%, rgba(13,148,136,0.35), transparent 50%), radial-gradient(ellipse at 90% 100%, rgba(14,116,144,0.25), transparent 45%), #020617",
          color: "#f1f5f9",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 16,
              background: "linear-gradient(135deg, #14b8a6, #0f766e)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 36,
              fontWeight: 700,
            }}
          >
            P
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 48, fontWeight: 700, letterSpacing: -1 }}>
              {SITE_NAME}
            </div>
            <div style={{ fontSize: 24, color: "#94a3b8" }}>{SITE_TAGLINE}</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              fontSize: 40,
              fontWeight: 600,
              lineHeight: 1.25,
              maxWidth: 900,
            }}
          >
            Find cheaper UK fuel without wasting the saving on the detour
          </div>
          <div style={{ fontSize: 22, color: "#94a3b8", maxWidth: 820 }}>
            Live Fuel Finder prices · route corridor comparison · MPG &amp; time
            cost
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
