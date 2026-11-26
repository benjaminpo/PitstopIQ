import { AppLogo } from "@/app/components/AppLogo";

/**
 * Full-page loading state for directory pages that wait on the Fuel Finder
 * dataset (station, brand and area pages). Used by their loading.tsx files.
 */
export function PageLoading({
  label = "Loading fuel prices…",
}: Readonly<{ label?: string }>) {
  return (
    <main
      aria-busy="true"
      className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-slate-950 px-6 text-center text-slate-100"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_20%,rgba(13,148,136,0.22),transparent_55%)]"
      />
      <div className="relative z-10 flex flex-col items-center">
        <div className="mb-8">
          <AppLogo />
        </div>
        <div
          aria-hidden
          className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-500/10 ring-1 ring-teal-500/30"
        >
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-teal-400" />
        </div>
        <p role="status" className="text-sm text-slate-400">
          {label}
        </p>
      </div>
    </main>
  );
}
