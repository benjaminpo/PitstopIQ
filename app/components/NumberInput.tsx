"use client";

import { useEffect, useRef, useState } from "react";

/** Trim float noise ("1.5490000000002" → "1.549") for display. */
function formatValue(n: number): string {
  return String(Number(n.toFixed(3)));
}

/**
 * Number input that tolerates intermediate editing states. The box keeps
 * its own text while focused (it can be emptied without the store value
 * snapping back into it) and commits the clamped value on blur or Enter.
 * Committing only on blur avoids half-typed values ("1" on the way to
 * "100") triggering store side effects. An empty or invalid box reverts
 * to the last committed value.
 */
export function NumberInput({
  value,
  onCommit,
  min,
  max,
  step,
  id,
  className,
  "aria-label": ariaLabel,
}: Readonly<{
  value: number;
  onCommit: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  id?: string;
  className?: string;
  "aria-label"?: string;
}>) {
  const [text, setText] = useState(() => formatValue(value));
  const focusedRef = useRef(false);

  // Reflect external updates (presets, shared links, auto base price)
  // only while the user isn't editing the field.
  useEffect(() => {
    if (!focusedRef.current) setText(formatValue(value));
  }, [value]);

  const commit = () => {
    const parsed = Number(text);
    if (text.trim() === "" || !Number.isFinite(parsed)) {
      setText(formatValue(value));
      return;
    }
    const next = Math.min(max, Math.max(min, parsed));
    onCommit(next);
    setText(formatValue(next));
  };

  return (
    <input
      id={id}
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step={step}
      value={text}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        focusedRef.current = false;
        commit();
      }}
      onKeyDown={(e) => {
        // Commit before the surrounding form's Enter-to-submit fires,
        // so the search uses the value visible in the box.
        if (e.key === "Enter") commit();
      }}
      className={className}
      aria-label={ariaLabel}
    />
  );
}
