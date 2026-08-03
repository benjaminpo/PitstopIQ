"use client";

import { useState } from "react";
import { Car, Loader2, Plus, Save, Search, Trash2 } from "lucide-react";
import { useSession } from "@/app/lib/auth-client";
import { usePitstopStore } from "@/app/lib/store";
import type { VehicleLookupResult } from "@/app/lib/vehicleLookup";
import { cn } from "@/app/lib/utils";

const FUEL_SHORT: Record<string, string> = {
  E10: "E10",
  E5: "E5",
  B7_Diesel: "Diesel",
};

function formatDateLabel(value: string | null): string {
  if (!value) return "—";
  // YYYY-MM → Month Year; YYYY-MM-DD → locale date
  if (/^\d{4}-\d{2}$/.test(value)) {
    const [y, m] = value.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("en-GB", {
      month: "short",
      year: "numeric",
    });
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function titleCase(value: string | null): string {
  if (!value) return "—";
  return value
    .toLowerCase()
    .split(/[\s_/]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function VehiclePresets() {
  const { data: session } = useSession();
  const signedIn = Boolean(session?.user);

  const {
    vehicle,
    vehiclePresets,
    activePresetId,
    applyVehiclePreset,
    saveVehiclePreset,
    updateVehiclePreset,
    deleteVehiclePreset,
    renameVehiclePreset,
    setVehicle,
    setFuelType,
  } = usePitstopStore();

  const [naming, setNaming] = useState(false);
  const [draftName, setDraftName] = useState("");

  const [plate, setPlate] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookup, setLookup] = useState<VehicleLookupResult | null>(null);

  const active = vehiclePresets.find((p) => p.id === activePresetId);
  const dirty =
    active != null &&
    (active.fuelType !== vehicle.fuelType ||
      active.mpg !== vehicle.mpg ||
      active.tankCapacityLitres !== vehicle.tankCapacityLitres);

  const onSaveNew = () => {
    const defaultName = `${FUEL_SHORT[vehicle.fuelType] ?? vehicle.fuelType} · ${vehicle.mpg} mpg`;
    if (!naming) {
      setDraftName(defaultName);
      setNaming(true);
      return;
    }
    saveVehiclePreset(draftName);
    setNaming(false);
    setDraftName("");
  };

  const onLookup = async () => {
    const q = plate.trim();
    if (!q) {
      setLookupError("Enter a registration plate.");
      return;
    }
    setLookupLoading(true);
    setLookupError(null);
    setLookup(null);
    try {
      const res = await fetch(
        `/api/vehicle-lookup?registration=${encodeURIComponent(q)}`
      );
      const data = (await res.json()) as {
        vehicle?: VehicleLookupResult;
        error?: string;
      };
      if (!res.ok || !data.vehicle) {
        setLookupError(data.error ?? "Lookup failed");
        return;
      }
      setLookup(data.vehicle);
    } catch {
      setLookupError("Could not reach vehicle lookup.");
    } finally {
      setLookupLoading(false);
    }
  };

  const applyLookup = (alsoSave: boolean) => {
    if (!lookup) return;

    setVehicle({
      tankCapacityLitres: lookup.tankCapacityLitres,
      ...(lookup.mpg != null ? { mpg: lookup.mpg } : {}),
      ...(lookup.fuelType ? { fuelType: lookup.fuelType } : {}),
    });
    // Refresh baseline price for the mapped grade (setVehicle alone skips this).
    if (lookup.fuelType) {
      setFuelType(lookup.fuelType);
    }

    const nameParts = [lookup.make, lookup.model]
      .filter(Boolean)
      .map((s) => titleCase(s!));
    const name =
      nameParts.length > 0
        ? nameParts.join(" ")
        : lookup.registration;

    if (alsoSave) {
      saveVehiclePreset(name);
    } else {
      setDraftName(name);
      setNaming(true);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-slate-400">
          <Car className="h-3.5 w-3.5" />
          Vehicle presets
        </span>
        <span className="text-[10px] text-slate-500">
          {signedIn ? "synced to your account" : "saved in this browser"}
        </span>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="vehicle-registration"
          className="text-[10px] font-medium tracking-wide text-slate-500"
        >
          Find by registration
        </label>
        <div className="flex gap-1.5">
          <input
            id="vehicle-registration"
            type="text"
            value={plate}
            onChange={(e) => setPlate(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void onLookup();
              }
            }}
            placeholder="e.g. AB12 CDE"
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-1.5 font-mono text-sm uppercase tracking-wider text-slate-100 outline-none ring-teal-500/40 placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-600 focus:border-teal-500/60 focus:ring-2"
            aria-label="UK registration plate"
          />
          <button
            type="button"
            onClick={() => void onLookup()}
            disabled={lookupLoading || !plate.trim()}
            className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 ring-1 ring-slate-700/60 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {lookupLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Search className="h-3.5 w-3.5" />
            )}
            Look up
          </button>
        </div>
        {lookupError && (
          <p className="text-[11px] text-rose-300/90">{lookupError}</p>
        )}
      </div>

      {lookup && (
        <div className="space-y-2 rounded-lg bg-slate-900/70 p-2.5 ring-1 ring-slate-700/60">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-mono text-sm font-semibold tracking-wider text-teal-300">
                {lookup.registration}
              </div>
              <div className="text-sm font-semibold text-slate-100">
                {titleCase(lookup.make)}
                {lookup.model ? ` ${titleCase(lookup.model)}` : ""}
              </div>
            </div>
            {lookup.source === "mock" && (
              <span className="shrink-0 rounded bg-amber-950/50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-300/90">
                Demo
              </span>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
            <div>
              <dt className="text-slate-500">Fuel</dt>
              <dd className="font-medium text-slate-200">
                {lookup.fuelTypeRaw
                  ? titleCase(lookup.fuelTypeRaw)
                  : "—"}
                {lookup.fuelType
                  ? ` → ${FUEL_SHORT[lookup.fuelType] ?? lookup.fuelType}`
                  : ""}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Hybrid</dt>
              <dd className="font-medium text-slate-200">
                {lookup.hybrid ? "Yes" : "No"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Registered</dt>
              <dd className="font-medium text-slate-200">
                {formatDateLabel(lookup.registeredDate)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Tax renewal</dt>
              <dd className="font-medium text-slate-200">
                {formatDateLabel(lookup.taxDueDate)}
                {lookup.taxStatus ? (
                  <span className="text-slate-500"> · {lookup.taxStatus}</span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">MOT renewal</dt>
              <dd className="font-medium text-slate-200">
                {formatDateLabel(lookup.motExpiryDate)}
                {lookup.motStatus ? (
                  <span className="text-slate-500"> · {lookup.motStatus}</span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">
                Tank size
                {lookup.tankCapacityEstimated ? " (est.)" : ""}
              </dt>
              <dd className="font-mono text-sm font-semibold text-teal-300">
                {lookup.tankCapacityLitres} L
              </dd>
            </div>
            {lookup.mpg != null && (
              <div className="col-span-2">
                <dt className="text-slate-500">
                  Suggested MPG{lookup.mpgEstimated ? " (est.)" : ""}
                </dt>
                <dd className="font-mono font-medium text-slate-200">
                  {lookup.mpg} mpg
                </dd>
              </div>
            )}
          </dl>

          <p className="text-[10px] leading-snug text-slate-500">
            Tank size is estimated from make, engine and weight — confirm against
            your handbook, then tweak Tank (L) below if needed.
          </p>

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => applyLookup(false)}
              className="inline-flex items-center gap-1 rounded-md bg-teal-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-teal-500"
            >
              Apply to form
            </button>
            <button
              type="button"
              onClick={() => applyLookup(true)}
              disabled={vehiclePresets.length >= 8}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-teal-300 transition hover:bg-teal-950/60 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-3 w-3" />
              Apply &amp; save preset
            </button>
          </div>
        </div>
      )}

      {vehiclePresets.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {vehiclePresets.map((preset) => {
            const selected = preset.id === activePresetId;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyVehiclePreset(preset.id)}
                onDoubleClick={() => {
                  const next = window.prompt("Rename preset", preset.name);
                  if (next?.trim()) {
                    renameVehiclePreset(preset.id, next);
                  }
                }}
                title={`${preset.name} · ${FUEL_SHORT[preset.fuelType] ?? preset.fuelType} · ${preset.mpg} mpg · ${preset.tankCapacityLitres} L (double-click to rename)`}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-left text-[11px] font-semibold transition",
                  selected
                    ? "bg-teal-600 text-white shadow-sm shadow-teal-900/40"
                    : "bg-slate-900/80 text-slate-300 ring-1 ring-slate-700/60 hover:bg-slate-800 hover:text-slate-100"
                )}
              >
                <div className="leading-tight">{preset.name}</div>
                <div
                  className={cn(
                    "mt-0.5 font-mono text-[10px] font-normal",
                    selected ? "text-teal-100/80" : "text-slate-500"
                  )}
                >
                  {FUEL_SHORT[preset.fuelType] ?? preset.fuelType} ·{" "}
                  {preset.mpg} mpg · {preset.tankCapacityLitres} L
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-[11px] text-slate-500">
          No presets yet — look up a plate or tune MPG / tank / fuel below, then
          save.
        </p>
      )}

      {naming && (
        <input
          type="text"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onSaveNew();
            }
            if (e.key === "Escape") {
              setNaming(false);
              setDraftName("");
            }
          }}
          placeholder="Preset name"
          className="w-full rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-1.5 text-sm text-slate-100 outline-none ring-teal-500/40 focus:border-teal-500/60 focus:ring-2"
          autoFocus
          aria-label="New preset name"
        />
      )}

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={onSaveNew}
          disabled={vehiclePresets.length >= 8 && !naming}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-teal-300 transition hover:bg-teal-950/60 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-3 w-3" />
          {naming ? "Confirm save" : "Save current"}
        </button>
        {active && dirty && (
          <button
            type="button"
            onClick={() => updateVehiclePreset(active.id)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-amber-300 transition hover:bg-amber-950/40"
          >
            <Save className="h-3 w-3" />
            Update “{active.name}”
          </button>
        )}
        {active && (
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(`Delete preset “${active.name}”?`)
              ) {
                deleteVehiclePreset(active.id);
              }
            }}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-rose-300/90 transition hover:bg-rose-950/40"
          >
            <Trash2 className="h-3 w-3" />
            Delete
          </button>
        )}
        {naming && (
          <button
            type="button"
            onClick={() => {
              setNaming(false);
              setDraftName("");
            }}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-slate-400 transition hover:bg-slate-800"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
