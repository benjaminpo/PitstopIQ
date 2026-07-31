import { getAdSensePublisherId } from "@/app/lib/adsense";

export const dynamic = "force-dynamic";

/**
 * Serves /ads.txt for AdSense verification.
 * https://support.google.com/adsense/answer/7532444
 */
export function GET() {
  const pub = getAdSensePublisherId();
  if (!pub) {
    return new Response("# AdSense not configured\n", {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    });
  }

  const body = `google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`;
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
