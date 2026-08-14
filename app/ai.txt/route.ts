import { buildAiTxt, resolveSiteUrl } from "@/app/lib/site";

export const dynamic = "force-static";

/** AI crawler hint file. Points at llms.txt and the sitemap. */
export function GET() {
  const body = buildAiTxt(resolveSiteUrl());
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
