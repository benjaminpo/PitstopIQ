"use client";

import { useState } from "react";
import { Car, Loader2, Pencil, Plus, Save, Search, Trash2 } from "lucide-react";
import { useSession } from "@/app/lib/auth-client";
import { vehicleFuelKind, vehicleFuelLabel } from "@/app/lib/fuelConstants";
import { usePitstopStore } from "@/app/lib/store";
import type { VehicleLookupResult } from "@/app/lib/vehicleLookup";
import { cn } from "@/app/lib/utils";

type NameMode =
  | { kind: "idle" }
  | { kind: "save" }
  | { kind: "rename"; id: string };

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

  const [nameMode, setNameMode] = useState<NameMode>({ kind: "idle" });
  const [draftName, setDraftName] = useState("");

  const [plate, setPlate] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookup, setLookup] = useState<VehicleLookupResult | null>(null);
  const [pendingRegistration, setPendingRegistration] = useState<string | null>(
    null
  );

  const active = vehiclePresets.find((p) => p.id === activePresetId);
  const pendingPlate = pendingRegistration?.trim().toUpperCase() || null;
  const activePlate = active?.registration?.trim().toUpperCase() || null;
  const registrationDirty =
    pendingPlate != null && pendingPlate !== activePlate;
  const dirty =
    active != null &&
    (vehicleFuelKind(active.fuelType) !== vehicleFuelKind(vehicle.fuelType) ||
      active.mpg !== vehicle.mpg ||
      active.tankCapacityLitres !== vehicle.tankCapacityLitres ||
      registrationDirty);

  const naming = nameMode.kind !== "idle";

  const resetNaming = () => {
    setNameMode({ kind: "idle" });
    setDraftName("");
  };

  const clearPendingRegistration = () => {
    setPendingRegistration(null);
  };

  const startRename = (id: string, currentName: string) => {
    setDraftName(currentName);
    setNameMode({ kind: "rename", id });
  };

  const onConfirmName = () => {
    if (nameMode.kind === "save") {
      saveVehiclePreset(draftName, {
        registration: pendingRegistration,
      });
      clearPendingRegistration();
      resetNaming();
      return;
    }
    if (nameMode.kind === "rename") {
      if (draftName.trim()) {
        renameVehiclePreset(nameMode.id, draftName);
      }
      resetNaming();
    }
  };

  const onSaveNew = () => {
    if (nameMode.kind !== "save") {
      const defaultName = `${vehicleFuelLabel(vehicle.fuelType)} · ${vehicle.mpg} mpg`;
      setDraftName(defaultName);
      clearPendingRegistration();
      setNameMode({ kind: "save" });
      return;
    }
    onConfirmName();
  };

  const onUpdateActive = (options?: {
    registration?: string | null;
    name?: string;
  }) => {
    if (!active) return;
    const patch: { registration?: string | null; name?: string } = {};
    if (options && "registration" in options) {
      patch.registration = options.registration;
    } else if (pendingRegistration != null) {
      patch.registration = pendingRegistration;
    }
    if (options?.name != null) {
      patch.name = options.name;
    }
    updateVehiclePreset(
      active.id,
      Object.keys(patch).length > 0 ? patch : undefined
    );
    clearPendingRegistration();
    resetNaming();
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

  const lookupDisplayName = (result: VehicleLookupResult): string => {
    const nameParts = [result.make, result.model]
      .filter(Boolean)
      .map((s) => titleCase(s!));
    return nameParts.length > 0 ? nameParts.join(" ") : result.registration;
  };

  const applyLookupToForm = (result: VehicleLookupResult) => {
    setVehicle({
      tankCapacityLitres: result.tankCapacityLitres,
      ...(result.mpg != null ? { mpg: result.mpg } : {}),
      ...(result.fuelType ? { fuelType: result.fuelType } : {}),
    });
    // Refresh baseline price for the mapped grade (setVehicle alone skips this).
    if (result.fuelType) {
      setFuelType(result.fuelType);
    }
    setPendingRegistration(result.registration);
  };

  const applyLookup = (mode: "form" | "new" | "update") => {
    if (!lookup) return;

    applyLookupToForm(lookup);
    const name = lookupDisplayName(lookup);

    if (mode === "update" && active) {
      onUpdateActive({
        registration: lookup.registration,
        name,
      });
      setLookup(null);
      return;
    }

    if (mode === "new") {
      saveVehiclePreset(name, { registration: lookup.registration });
      clearPendingRegistration();
      resetNaming();
      setLookup(null);
      return;
    }

    // Apply to form: prompt to save when nothing is selected; otherwise Update appears.
    if (!active) {
      setDraftName(name);
      setNameMode({ kind: "save" });
    } else {
      resetNaming();
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
            {lookup.source === "mock" ? (
              <span className="shrink-0 rounded bg-amber-950/50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-300/90">
                Demo
              </span>
            ) : (
              <span className="shrink-0 rounded bg-teal-950/50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-teal-300/90">
                Live
              </span>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
            <div>
              <dt className="text-slate-500">Fuel</dt>
              <dd className="font-medium text-slate-200">
                {lookup.fuelTypeRaw ? titleCase(lookup.fuelTypeRaw) : "—"}
                {lookup.fuelType
                  ? ` → ${vehicleFuelLabel(lookup.fuelType)}`
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
            Tank size and MPG are estimated from make, engine
            {lookup.taxDueDate || lookup.taxStatus
              ? ", and weight"
              : ""}{" "}
            — confirm against your handbook, then tweak Tank (L) / MPG below if
            needed.
          </p>

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => applyLookup("form")}
              className="inline-flex items-center gap-1 rounded-md bg-teal-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-teal-500"
            >
              Apply to form
            </button>
            {active && (
              <button
                type="button"
                onClick={() => applyLookup("update")}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-amber-300 transition hover:bg-amber-950/40"
              >
                <Save className="h-3 w-3" />
                Update “{active.name}”
              </button>
            )}
            <button
              type="button"
              onClick={() => applyLookup("new")}
              disabled={vehiclePresets.length >= 8}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-teal-300 transition hover:bg-teal-950/60 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-3 w-3" />
              Save as new preset
            </button>
          </div>
        </div>
      )}

      {vehiclePresets.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {vehiclePresets.map((preset) => {
            const selected = preset.id === activePresetId;
            const fuelLabel = vehicleFuelLabel(preset.fuelType);
            const plateLabel = preset.registration?.trim() || null;
            const titleParts = [
              preset.name,
              ...(plateLabel ? [plateLabel] : []),
              fuelLabel,
              `${preset.mpg} mpg`,
              `${preset.tankCapacityLitres} L (double-click to rename)`,
            ];
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyVehiclePreset(preset.id)}
                onDoubleClick={() => startRename(preset.id, preset.name)}
                title={titleParts.join(" · ")}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-left text-[11px] font-semibold transition",
                  selected
                    ? "bg-teal-600 text-white shadow-sm shadow-teal-900/40"
                    : "bg-slate-900/80 text-slate-300 ring-1 ring-slate-700/60 hover:bg-slate-800 hover:text-slate-100"
                )}
              >
                <div className="leading-tight">{preset.name}</div>
                {plateLabel && (
                  <div
                    className={cn(
                      "mt-0.5 font-mono text-[10px] font-semibold tracking-wider",
                      selected ? "text-teal-50" : "text-teal-300/90"
                    )}
                  >
                    {plateLabel}
                  </div>
                )}
                <div
                  className={cn(
                    "mt-0.5 font-mono text-[10px] font-normal",
                    selected ? "text-teal-100/80" : "text-slate-500"
                  )}
                >
                  {fuelLabel} · {preset.mpg} mpg · {preset.tankCapacityLitres} L
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
              onConfirmName();
            }
            if (e.key === "Escape") {
              resetNaming();
            }
          }}
          placeholder="Vehicle name"
          maxLength={40}
          className="w-full rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-1.5 text-sm text-slate-100 outline-none ring-teal-500/40 focus:border-teal-500/60 focus:ring-2"
          autoFocus
          aria-label={
            nameMode.kind === "rename" ? "Rename vehicle" : "New preset name"
          }
        />
      )}

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={onSaveNew}
          disabled={vehiclePresets.length >= 8 && nameMode.kind !== "save"}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-teal-300 transition hover:bg-teal-950/60 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-3 w-3" />
          {nameMode.kind === "save" ? "Confirm save" : "Save current"}
        </button>
        {active && dirty && nameMode.kind === "idle" && (
          <button
            type="button"
            onClick={() => onUpdateActive()}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-amber-300 transition hover:bg-amber-950/40"
          >
            <Save className="h-3 w-3" />
            Update “{active.name}”
          </button>
        )}
        {active && nameMode.kind === "idle" && (
          <button
            type="button"
            onClick={() => startRename(active.id, active.name)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-slate-300 transition hover:bg-slate-800"
          >
            <Pencil className="h-3 w-3" />
            Rename
          </button>
        )}
        {nameMode.kind === "rename" && (
          <button
            type="button"
            onClick={onConfirmName}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-teal-300 transition hover:bg-teal-950/60"
          >
            <Pencil className="h-3 w-3" />
            Confirm rename
          </button>
        )}
        {active && nameMode.kind === "idle" && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Delete preset “${active.name}”?`)) {
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
            onClick={resetNaming}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-slate-400 transition hover:bg-slate-800"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
