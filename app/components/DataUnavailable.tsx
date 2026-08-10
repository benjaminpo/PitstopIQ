import Link from "next/link";
import { AppLogo } from "@/app/components/AppLogo";

interface DataUnavailableAction {
  href: string;
  label: string;
  primary?: boolean;
}

interface DataUnavailableProps {
  title: string;
  description: string;
  actions: DataUnavailableAction[];
}

/** Full-page empty state when live Fuel Finder data cannot be loaded. */
export function DataUnavailable({
  title,
  description,
  actions,
}: Readonly<DataUnavailableProps>) {
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
        <div
          aria-hidden
          className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-500/10 ring-1 ring-teal-500/30"
        >
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-teal-400" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          {title}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          {description}
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          {actions.map((action) =>
            action.primary ? (
              <Link
                key={action.href + action.label}
                href={action.href}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-500"
              >
                {action.label}
              </Link>
            ) : (
              <Link
                key={action.href + action.label}
                href={action.href}
                className="rounded-lg border border-slate-700/80 bg-slate-900/50 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-teal-600/50 hover:text-teal-200"
              >
                {action.label}
              </Link>
            )
          )}
        </div>
      </div>
    </main>
  );
}
