"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Bell,
  Car,
  Check,
  Fuel,
  Gauge,
  Loader2,
  UserRound,
} from "lucide-react";
import { AppLogo } from "@/app/components/AppLogo";
import { DirectoryShell } from "@/app/components/DirectoryShell";
import { NumberInput } from "@/app/components/NumberInput";
import { PriceAlertsPanel } from "@/app/components/PriceAlertsPanel";
import { VehiclePresets } from "@/app/components/VehiclePresets";
import { VehiclePresetsSync } from "@/app/components/VehiclePresetsSync";
import { updateUser, useSession } from "@/app/lib/auth-client";
import { VEHICLE_FUEL_OPTIONS, vehicleFuelKind } from "@/app/lib/fuelConstants";
import { usePitstopStore } from "@/app/lib/store";
import { joinDisplayName, splitDisplayName } from "@/app/lib/userName";
import { cn } from "@/app/lib/utils";

const inputClass =
  "w-full rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none ring-teal-500/40 transition placeholder:text-slate-500 focus:border-teal-500/60 focus:ring-2";

export function AccountSettings() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const { vehicle, setVehicle, setFuelType } = usePitstopStore();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);

  const sessionUserId = session?.user?.id ?? null;
  if (session && sessionUserId !== profileUserId) {
    const parts = splitDisplayName(session.user.name);
    setProfileUserId(sessionUserId);
    setFirstName(parts.firstName);
    setLastName(parts.lastName);
  }

  useEffect(() => {
    if (isPending) return;
    if (!session) {
      router.replace("/login");
    }
  }, [session, isPending, router]);

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (savingProfile) return;

    const name = joinDisplayName(firstName, lastName);
    if (!name) {
      setProfileError("Enter at least a first or last name.");
      return;
    }

    setSavingProfile(true);
    setProfileError(null);
    setProfileSaved(false);

    const result = await updateUser({ name });
    if (result.error) {
      setProfileError(result.error.message ?? "Could not update profile");
      setSavingProfile(false);
      return;
    }

    const parts = splitDisplayName(name);
    setFirstName(parts.firstName);
    setLastName(parts.lastName);
    setSavingProfile(false);
    setProfileSaved(true);
    router.refresh();
  };

  if (isPending || !session) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-950 text-sm text-slate-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading account…
      </div>
    );
  }

  return (
    <DirectoryShell width="narrow" className="px-0" contentClassName="px-4 py-10 sm:px-4">
      <VehiclePresetsSync />
        <div className="mb-2 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 transition hover:text-slate-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to planner
          </Link>
          <Link
            href="/"
            className="flex items-center gap-2"
            aria-label="PitstopIQ home"
          >
            <AppLogo />
          </Link>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-800/80 bg-slate-950/95 p-5 shadow-2xl shadow-slate-950/60 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <UserRound className="h-4 w-4 text-teal-400" />
              <h1 className="text-lg font-semibold text-white">Profile</h1>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Update how your name appears on contributions and your account.
            </p>

            <form
              onSubmit={handleSaveProfile}
              className="mt-5 flex flex-col gap-4"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-slate-300">
                    First name
                  </span>
                  <input
                    type="text"
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(e) => {
                      setFirstName(e.target.value);
                      setProfileSaved(false);
                    }}
                    placeholder="Alex"
                    className={inputClass}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-slate-300">
                    Last name
                  </span>
                  <input
                    type="text"
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(e) => {
                      setLastName(e.target.value);
                      setProfileSaved(false);
                    }}
                    placeholder="Driver"
                    className={inputClass}
                  />
                </label>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-slate-300">Email</span>
                <input
                  type="email"
                  value={session.user.email}
                  disabled
                  className={`${inputClass} cursor-not-allowed opacity-70`}
                />
              </label>

              {profileError && (
                <p
                  role="alert"
                  className="rounded-lg border border-rose-800/50 bg-rose-950/40 px-3 py-2 text-xs text-rose-300"
                >
                  {profileError}
                </p>
              )}

              <button
                type="submit"
                disabled={savingProfile}
                className="flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-teal-950/50 transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingProfile && <Loader2 className="h-4 w-4 animate-spin" />}
                {!savingProfile && profileSaved && (
                  <Check className="h-4 w-4" />
                )}
                {profileSaved ? "Saved" : "Save profile"}
              </button>
            </form>
          </section>

          <section
            id="alerts"
            className="rounded-2xl border border-slate-800/80 bg-slate-950/95 p-5 shadow-2xl shadow-slate-950/60 backdrop-blur-md"
          >
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-teal-400" />
              <h2 className="text-lg font-semibold text-white">Price alerts</h2>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Watch favourite stations. When Fuel Finder prices drop enough,
              you&apos;ll see it here next time you open the app.
            </p>
            <div className="mt-5">
              <PriceAlertsPanel />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800/80 bg-slate-950/95 p-5 shadow-2xl shadow-slate-950/60 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <Car className="h-4 w-4 text-teal-400" />
              <h2 className="text-lg font-semibold text-white">Vehicles</h2>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Look up a UK plate, tune MPG and tank size, and save presets synced
              to your account.
            </p>

            <div className="mt-5 space-y-4">
              <VehiclePresets />

              <div className="space-y-2">
                <span className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-slate-400">
                  <Fuel className="h-3.5 w-3.5" />
                  Fuel type
                </span>
                <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-slate-900/80 p-1 ring-1 ring-slate-700/60">
                  {VEHICLE_FUEL_OPTIONS.map((opt) => {
                    const active = vehicleFuelKind(vehicle.fuelType) === opt.kind;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setFuelType(opt.value)}
                        className={cn(
                          "rounded-md px-2 py-2 text-center text-[11px] font-semibold transition",
                          active
                            ? "bg-teal-600 text-white shadow-sm shadow-teal-900/40"
                            : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                        )}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label htmlFor="account-vehicle-mpg" className="block space-y-1.5">
                <span className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-slate-400">
                  <Gauge className="h-3.5 w-3.5" />
                  Vehicle MPG
                </span>
                <div className="relative">
                  <NumberInput
                    id="account-vehicle-mpg"
                    min={1}
                    max={150}
                    step={0.1}
                    value={vehicle.mpg}
                    onCommit={(mpg) => setVehicle({ mpg })}
                    className="w-full rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-2 pr-12 font-mono text-sm text-slate-100 outline-none ring-teal-500/40 transition focus:border-teal-500/60 focus:ring-2"
                    aria-label="Vehicle MPG"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                    mpg
                  </span>
                </div>
              </label>

              <label htmlFor="account-tank-capacity" className="block space-y-1.5">
                <span className="text-xs font-medium tracking-wide text-slate-400">
                  Tank (L)
                </span>
                <NumberInput
                  id="account-tank-capacity"
                  min={10}
                  max={200}
                  step={1}
                  value={vehicle.tankCapacityLitres}
                  onCommit={(tankCapacityLitres) =>
                    setVehicle({ tankCapacityLitres })
                  }
                  className="w-full rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-2 font-mono text-sm text-slate-100 outline-none focus:border-teal-500/60 focus:ring-2 focus:ring-teal-500/40"
                  aria-label="Tank capacity in litres"
                />
              </label>
            </div>
          </section>
        </div>
    </DirectoryShell>
  );
}
