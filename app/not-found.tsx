import Link from "next/link";
import { AppLogo } from "@/app/components/AppLogo";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-slate-950 px-6 text-center text-slate-100">
      <div className="mb-6">
        <AppLogo size="lg" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 max-w-md text-sm text-slate-400">
        That link doesn’t lead anywhere. Head back to compare UK fuel prices
        along your route.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-500"
      >
        Back to PitstopIQ
      </Link>
    </main>
  );
}
