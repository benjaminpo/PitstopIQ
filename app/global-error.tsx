"use client";

import { useEffect } from "react";
import "./globals.css";

/**
 * Last-resort boundary for errors in the root layout itself. It replaces the
 * whole document, so it renders its own <html>/<body> and avoids app
 * components that might be the source of the failure.
 */
export default function GlobalError({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  useEffect(() => {
    console.error("[PitstopIQ] global error", error);
  }, [error]);

  return (
    <html lang="en-GB" className="dark">
      <body className="min-h-dvh bg-slate-950 font-sans text-slate-100 antialiased">
        <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            PitstopIQ is having trouble
          </h1>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-400">
            Something went wrong loading the app. Please try again in a moment.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={reset}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-500"
            >
              Try again
            </button>
            {/* Full reload (not client navigation): the root layout is broken. */}
            <button
              type="button"
              onClick={() => window.location.assign("/")}
              className="rounded-lg border border-slate-700/80 bg-slate-900/50 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-teal-600/50 hover:text-teal-200"
            >
              Reload home
            </button>
          </div>
          {error.digest && (
            <p className="mt-6 font-mono text-xs text-slate-500">
              Reference: {error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
