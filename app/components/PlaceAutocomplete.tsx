"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { History, Loader2, MapPin } from "lucide-react";
import { searchPlaces, type PlaceSuggestion } from "@/app/lib/placeSearch";
import { cn } from "@/app/lib/utils";

interface PlaceAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (place: PlaceSuggestion) => void;
  /** Saved past selections, shown before the user types a query */
  recentPlaces?: PlaceSuggestion[];
  onClearRecent?: () => void;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
}

export function PlaceAutocomplete({
  value,
  onChange,
  onSelect,
  recentPlaces,
  onClearRecent,
  placeholder,
  ariaLabel,
  disabled,
}: PlaceAutocompleteProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // True only when the latest value change came from the user typing in the
  // input, as opposed to programmatic updates (shared-link hydration, swap,
  // geolocation, preset selection). Programmatic changes must not trigger a
  // search or open the dropdown.
  const typedRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [highlight, setHighlight] = useState(-1);
  const [error, setError] = useState<string | null>(null);

  const recents = recentPlaces ?? [];
  const query = value.trim();
  // With no usable query yet, the dropdown offers saved history instead.
  const recentMode = query.length < 2 && recents.length > 0;
  const displayed = recentMode ? recents : suggestions;

  // Reset the keyboard highlight when the list switches between recents and
  // live suggestions (adjust-state-during-render, not an effect).
  const [prevRecentMode, setPrevRecentMode] = useState(recentMode);
  if (prevRecentMode !== recentMode) {
    setPrevRecentMode(recentMode);
    setHighlight(-1);
  }

  useEffect(() => {
    const typed = typedRef.current;
    typedRef.current = false;

    if (!typed) {
      abortRef.current?.abort();
      setSuggestions([]);
      setLoading(false);
      setError(null);
      setOpen(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const handle = window.setTimeout(() => {
      if (value.trim().length < 2) {
        setSuggestions([]);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      void searchPlaces(value, { signal: controller.signal })
        .then((results) => {
          if (controller.signal.aborted) return;
          setSuggestions(results);
          setHighlight(results.length > 0 ? 0 : -1);
          setOpen(true);
        })
        .catch((e: unknown) => {
          if (controller.signal.aborted) return;
          setSuggestions([]);
          setError(e instanceof Error ? e.message : "Search failed");
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 280);

    return () => {
      window.clearTimeout(handle);
      controller.abort();
    };
  }, [value]);

  useEffect(() => {
    function onDocPointer(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocPointer);
    return () => document.removeEventListener("mousedown", onDocPointer);
  }, []);

  const pick = useCallback(
    (place: PlaceSuggestion) => {
      onSelect(place);
      setOpen(false);
      setSuggestions([]);
      setHighlight(-1);
    },
    [onSelect]
  );

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open || displayed.length === 0) {
      if (e.key === "ArrowDown" && displayed.length > 0) setOpen(true);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % displayed.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h <= 0 ? displayed.length - 1 : h - 1));
    } else if (e.key === "Enter" && highlight >= 0) {
      e.preventDefault();
      pick(displayed[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showList =
    open && (displayed.length > 0 || (!recentMode && (loading || !!error)));

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={value}
          disabled={disabled}
          autoComplete="off"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            highlight >= 0 ? `${listId}-opt-${highlight}` : undefined
          }
          aria-label={ariaLabel}
          placeholder={placeholder}
          onChange={(e) => {
            typedRef.current = true;
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (recentMode || suggestions.length > 0 || query.length >= 2) {
              setOpen(true);
            }
          }}
          onKeyDown={onKeyDown}
          className="w-full rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-2 pr-9 text-sm text-slate-100 placeholder:text-slate-500 outline-none ring-teal-500/40 transition focus:border-teal-500/60 focus:ring-2 disabled:opacity-60"
        />
        {loading && (
          <Loader2 className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
        )}
      </div>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-xl shadow-black/40"
        >
          {recentMode && (
            <li className="flex items-center justify-between px-3 pb-1 pt-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Recent searches
              </span>
              {onClearRecent && (
                <button
                  type="button"
                  onClick={onClearRecent}
                  className="text-[10px] font-semibold text-slate-500 transition hover:text-slate-300"
                >
                  Clear
                </button>
              )}
            </li>
          )}
          {!recentMode && error && (
            <li className="px-3 py-2 text-xs text-rose-400">{error}</li>
          )}
          {!recentMode && !error && loading && suggestions.length === 0 && (
            <li className="px-3 py-2 text-xs text-slate-400">Searching…</li>
          )}
          {!recentMode &&
            !error &&
            !loading &&
            suggestions.length === 0 &&
            query.length >= 2 && (
              <li className="px-3 py-2 text-xs text-slate-400">
                No places found
              </li>
            )}
          {displayed.map((place, index) => (
            <li
              key={place.id}
              id={`${listId}-opt-${index}`}
              role="option"
              aria-selected={highlight === index}
            >
              <button
                type="button"
                className={cn(
                  "flex w-full items-start gap-2 px-3 py-2 text-left transition",
                  highlight === index
                    ? "bg-teal-950/70 text-teal-100"
                    : "text-slate-200 hover:bg-slate-800"
                )}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => pick(place)}
              >
                {recentMode ? (
                  <History className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                ) : (
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-400" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium">
                      {place.label}
                    </span>
                    {place.postcode && (
                      <span className="shrink-0 font-mono text-[11px] font-semibold text-teal-300/90">
                        {place.postcode}
                      </span>
                    )}
                  </span>
                  {place.secondary && (
                    <span className="mt-0.5 block truncate text-[11px] text-slate-400">
                      {place.secondary}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
