"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bell, Fuel, LogIn, LogOut, MapPin, Settings, Store, UserRound } from "lucide-react";
import { signOut, useSession } from "@/app/lib/auth-client";

export function AccountMenu() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [open, setOpen] = useState(false);
  const [unreadAlertsState, setUnreadAlerts] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!session?.user) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/price-alerts?evaluate=1");
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { unreadCount?: number };
        if (!cancelled) setUnreadAlerts(data.unreadCount ?? 0);
      } catch {
        // Badge is optional.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user]);

  const unreadAlerts = session?.user ? unreadAlertsState : 0;

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
        aria-label={
          unreadAlerts > 0
            ? `Account menu, ${unreadAlerts} unread price alerts`
            : "Account menu"
        }
        className="relative flex h-8 w-8 items-center justify-center rounded-full border border-teal-700/60 bg-teal-950/60 text-sm font-semibold text-teal-200 transition hover:border-teal-500/70 hover:bg-teal-900/60"
      >
        {initial || <UserRound className="h-4 w-4" />}
        {unreadAlerts > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-teal-500 px-0.5 text-[9px] font-bold text-white">
            {unreadAlerts > 9 ? "9+" : unreadAlerts}
          </span>
        )}
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
            href="/stations"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-300 transition hover:bg-slate-800/80 hover:text-slate-100"
          >
            <Fuel className="h-3.5 w-3.5" />
            Stations
          </Link>
          <Link
            href="/locations"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-300 transition hover:bg-slate-800/80 hover:text-slate-100"
          >
            <MapPin className="h-3.5 w-3.5" />
            Locations
          </Link>
          <Link
            href="/brands"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-300 transition hover:bg-slate-800/80 hover:text-slate-100"
          >
            <Store className="h-3.5 w-3.5" />
            Brands
          </Link>
          <div className="mx-1 my-1 h-px bg-slate-800/80" />
          <Link
            href="/account#alerts"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-300 transition hover:bg-slate-800/80 hover:text-slate-100"
          >
            <span className="inline-flex items-center gap-2">
              <Bell className="h-3.5 w-3.5" />
              Price alerts
            </span>
            {unreadAlerts > 0 && (
              <span className="rounded-full bg-teal-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {unreadAlerts}
              </span>
            )}
          </Link>
          <Link
            href="/account"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-300 transition hover:bg-slate-800/80 hover:text-slate-100"
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
