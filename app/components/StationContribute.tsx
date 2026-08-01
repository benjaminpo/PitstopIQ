"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2, MessageSquare, Star, Trash2 } from "lucide-react";
import { useSession } from "@/app/lib/auth-client";
import { usePitstopStore } from "@/app/lib/store";
import type { FuelType, StationCommunitySummary } from "@/app/lib/types";
import { cn } from "@/app/lib/utils";

interface MineContribution {
  fuelType: FuelType;
  pricePerLitre: number | null;
  comment: string | null;
  rating: number | null;
}

const inputClass =
  "w-full rounded-lg border border-slate-700/80 bg-slate-950/60 px-2.5 py-1.5 text-sm text-slate-100 outline-none ring-teal-500/40 transition placeholder:text-slate-500 focus:border-teal-500/60 focus:ring-2";

function Stars({
  value,
  onChange,
  readOnly,
}: Readonly<{
  value: number;
  onChange?: (n: number) => void;
  readOnly?: boolean;
}>) {
  return (
    <div className="flex items-center gap-0.5" role={readOnly ? "img" : "group"}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value;
        if (readOnly) {
          return (
            <Star
              key={n}
              className={cn(
                "h-3.5 w-3.5",
                filled
                  ? "fill-amber-400 text-amber-400"
                  : "text-slate-600"
              )}
            />
          );
        }
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange?.(n)}
            className="rounded p-0.5 transition hover:scale-110"
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            aria-pressed={filled}
          >
            <Star
              className={cn(
                "h-5 w-5",
                filled
                  ? "fill-amber-400 text-amber-400"
                  : "text-slate-600 hover:text-amber-300"
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

export function StationContribute({
  stationId,
  stationName,
  fuelType,
  officialPrice,
  community,
}: Readonly<{
  stationId: string;
  stationName: string;
  fuelType: FuelType;
  officialPrice?: number;
  community?: StationCommunitySummary;
}>) {
  const { data: session, isPending: sessionPending } = useSession();
  const setCommunitySummary = usePitstopStore((s) => s.setCommunitySummary);

  const [price, setPrice] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [mineLoaded, setMineLoaded] = useState(false);
  const [hasMine, setHasMine] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(
          `/api/station-contributions/${encodeURIComponent(stationId)}`
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          summary?: StationCommunitySummary | null;
          mine?: MineContribution | null;
        };
        if (cancelled) return;
        if (data.summary) setCommunitySummary(stationId, data.summary);
        if (data.mine) {
          setHasMine(true);
          setPrice(
            data.mine.pricePerLitre != null
              ? String(data.mine.pricePerLitre)
              : ""
          );
          setRating(data.mine.rating ?? 0);
          setComment(data.mine.comment ?? "");
        } else {
          setHasMine(false);
          setPrice(officialPrice != null ? officialPrice.toFixed(3) : "");
          setRating(0);
          setComment("");
        }
      } finally {
        if (!cancelled) setMineLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [stationId, session?.user?.id, officialPrice, setCommunitySummary]);

  const applyResponse = (data: {
    summary?: StationCommunitySummary | null;
    mine?: MineContribution | null;
  }) => {
    if (data.summary) setCommunitySummary(stationId, data.summary);
    if (data.mine) {
      setHasMine(true);
      setPrice(
        data.mine.pricePerLitre != null ? String(data.mine.pricePerLitre) : ""
      );
      setRating(data.mine.rating ?? 0);
      setComment(data.mine.comment ?? "");
    } else {
      setHasMine(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    setSavedFlash(false);

    try {
      const res = await fetch("/api/station-contributions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stationId,
          fuelType,
          pricePerLitre: price.trim() === "" ? null : Number(price),
          rating: rating === 0 ? null : rating,
          comment: comment.trim() || null,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        summary?: StationCommunitySummary | null;
        mine?: MineContribution | null;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not save");
        return;
      }
      applyResponse(data);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 2000);
    } catch {
      setError("Network error — try again");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (submitting || !hasMine) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/station-contributions/${encodeURIComponent(stationId)}`,
        { method: "DELETE" }
      );
      const data = (await res.json()) as {
        error?: string;
        summary?: StationCommunitySummary | null;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not delete");
        return;
      }
      if (data.summary) setCommunitySummary(stationId, data.summary);
      setHasMine(false);
      setPrice(officialPrice != null ? officialPrice.toFixed(3) : "");
      setRating(0);
      setComment("");
    } catch {
      setError("Network error — try again");
    } finally {
      setSubmitting(false);
    }
  };

  const comments = community?.recentComments ?? [];

  return (
    <div
      className="mt-3 border-t border-slate-800/80 pt-3"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {(community?.ratingCount ?? 0) > 0 || comments.length > 0 ? (
        <div className="mb-3 space-y-2">
          {community && community.ratingCount > 0 && (
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <Stars value={Math.round(community.avgRating ?? 0)} readOnly />
              <span className="font-mono text-slate-400">
                {(community.avgRating ?? 0).toFixed(1)} · {community.ratingCount}{" "}
                {community.ratingCount === 1 ? "rating" : "ratings"}
              </span>
            </div>
          )}
          {comments.length > 0 && (
            <ul className="space-y-1.5">
              {comments.map((c, i) => (
                <li
                  key={`${c.userName}-${c.updatedAt}-${i}`}
                  className="rounded-lg bg-slate-950/50 px-2.5 py-2 text-[11px]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-300">
                      {c.userName}
                    </span>
                    {c.rating != null && (
                      <Stars value={c.rating} readOnly />
                    )}
                  </div>
                  <p className="mt-0.5 text-slate-400">{c.comment}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {sessionPending || !mineLoaded ? (
        <p className="flex items-center gap-2 text-[11px] text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading member updates…
        </p>
      ) : !session ? (
        <p className="text-[11px] text-slate-400">
          <Link
            href="/login"
            className="font-medium text-teal-300 hover:text-teal-200"
          >
            Sign in
          </Link>{" "}
          to update the pump price, leave a rating, or comment on{" "}
          {stationName}.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-2.5">
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-300">
            <MessageSquare className="h-3.5 w-3.5 text-teal-400" />
            {hasMine ? "Update your report" : "Report price & rate"}
          </p>

          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-slate-500">
                {fuelType.replace("_", " ")} £/L
              </span>
              <input
                type="number"
                inputMode="decimal"
                step="0.001"
                min="0.8"
                max="3.5"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="1.349"
                className={cn(inputClass, "font-mono")}
              />
            </label>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-slate-500">
                Rating
              </span>
              <div className="flex h-[34px] items-center">
                <Stars value={rating} onChange={setRating} />
              </div>
            </div>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-slate-500">
              Comment
            </span>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Busy forecourt, pumps working…"
              className={cn(inputClass, "resize-none")}
            />
          </label>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-rose-800/50 bg-rose-950/40 px-2.5 py-1.5 text-[11px] text-rose-300"
            >
              {error}
            </p>
          )}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {savedFlash ? "Saved" : hasMine ? "Update" : "Submit"}
            </button>
            {hasMine && (
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={submitting}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-700/80 px-2.5 py-1.5 text-xs text-slate-400 transition hover:border-rose-700/50 hover:text-rose-300 disabled:opacity-60"
                aria-label="Remove your report"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
