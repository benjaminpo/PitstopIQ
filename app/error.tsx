"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AppLogo } from "@/app/components/AppLogo";

/**
 * Route-level error boundary: shown when a page or component below the root
 * layout throws while rendering. The root layout (analytics etc.) stays mounted.
 */
export default function ErrorPage({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  useEffect(() => {
    console.error("[PitstopIQ] page error", error);
  }, [error]);

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-slate-950 px-6 text-center text-slate-100">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_20%,rgba(13,148,136,0.22),transparent_55%),radial-gradient(ellipse_at_80%_90%,rgba(14,116,144,0.14),transparent_45%)]"
      />
      <div className="relative z-10 flex max-w-md flex-col items-center">
        <Link href="/" aria-label="PitstopIQ home" className="mb-8">
          <AppLogo />
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          This page hit an unexpected error. Try again — if it keeps happening,
          head back to the route planner.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-500"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-lg border border-slate-700/80 bg-slate-900/50 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-teal-600/50 hover:text-teal-200"
          >
            Back to PitstopIQ
          </Link>
        </div>
        {error.digest && (
          <p className="mt-6 font-mono text-xs text-slate-500">
            Reference: {error.digest}
          </p>
        )}
      </div>
    </main>
  );
}
