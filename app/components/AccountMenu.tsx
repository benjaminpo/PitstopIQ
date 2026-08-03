"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LogIn, LogOut, Settings, UserRound } from "lucide-react";
import { signOut, useSession } from "@/app/lib/auth-client";

export function AccountMenu() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  if (isPending) {
    return (
      <span
        aria-hidden
        className="h-8 w-8 animate-pulse rounded-full bg-slate-800"
      />
    );
  }

  if (!session) {
    return (
      <Link
        href="/login"
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-900/60 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:border-teal-600/50 hover:bg-teal-950/50 hover:text-teal-200"
      >
        <LogIn className="h-3.5 w-3.5" />
        Sign in
      </Link>
    );
  }

  const initial = (session.user.name || session.user.email || "?")
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex h-8 w-8 items-center justify-center rounded-full border border-teal-700/60 bg-teal-950/60 text-sm font-semibold text-teal-200 transition hover:border-teal-500/70 hover:bg-teal-900/60"
      >
        {initial || <UserRound className="h-4 w-4" />}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-10 z-50 w-56 rounded-xl border border-slate-700/80 bg-slate-950/95 p-1.5 shadow-2xl shadow-slate-950/70 backdrop-blur-md"
        >
          <div className="px-2.5 py-2">
            <p className="truncate text-sm font-medium text-slate-100">
              {session.user.name}
            </p>
            <p className="truncate text-xs text-slate-400">
              {session.user.email}
            </p>
          </div>
          <div className="mx-1 h-px bg-slate-800/80" />
          <Link
            href="/account"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-300 transition hover:bg-slate-800/80 hover:text-slate-100"
          >
            <Settings className="h-3.5 w-3.5" />
            Manage account
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              setOpen(false);
              await signOut({
                fetchOptions: {
                  onSuccess: () => router.refresh(),
                },
              });
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-300 transition hover:bg-slate-800/80 hover:text-slate-100"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
