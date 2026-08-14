import { buildLlmsTxt, resolveSiteUrl } from "@/app/lib/site";

export const dynamic = "force-static";

/** Machine-readable site summary for LLM / AI crawlers. https://llmstxt.org */
export function GET() {
  const body = buildLlmsTxt(resolveSiteUrl());
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
