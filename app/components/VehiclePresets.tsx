"use client";

import { useState } from "react";
import { Car, Plus, Save, Trash2 } from "lucide-react";
import { useSession } from "@/app/lib/auth-client";
import { usePitstopStore } from "@/app/lib/store";
import { cn } from "@/app/lib/utils";

const FUEL_SHORT: Record<string, string> = {
  E10: "E10",
  E5: "E5",
  B7_Diesel: "Diesel",
};

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
  } = usePitstopStore();

  const [naming, setNaming] = useState(false);
  const [draftName, setDraftName] = useState("");

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
          No presets yet — tune MPG / tank / fuel below, then save.
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
