"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Fuel, Loader2, MessageSquare, Star, Trash2 } from "lucide-react";
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

type SaveKind = "price" | "review";

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
  const [hasPrice, setHasPrice] = useState(false);
  const [hasReview, setHasReview] = useState(false);
  const [busy, setBusy] = useState<SaveKind | "clear-price" | "clear-review" | null>(
    null
  );
  const [priceError, setPriceError] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [priceSaved, setPriceSaved] = useState(false);
  const [reviewSaved, setReviewSaved] = useState(false);

  const applyMine = (mine: MineContribution | null | undefined) => {
    if (!mine) {
      setHasPrice(false);
      setHasReview(false);
      setPrice(officialPrice != null ? officialPrice.toFixed(3) : "");
      setRating(0);
      setComment("");
      return;
    }
    setHasPrice(mine.pricePerLitre != null);
    setHasReview(mine.rating != null || Boolean(mine.comment));
    setPrice(
      mine.pricePerLitre != null
        ? String(mine.pricePerLitre)
        : officialPrice != null
          ? officialPrice.toFixed(3)
          : ""
    );
    setRating(mine.rating ?? 0);
    setComment(mine.comment ?? "");
  };

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
        applyMine(data.mine);
      } finally {
        if (!cancelled) setMineLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remounted via key={stationId}
  }, [stationId, session?.user?.id, setCommunitySummary]);

  const postContribution = async (
    body: Record<string, unknown>,
    flash: SaveKind
  ) => {
    const res = await fetch("/api/station-contributions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as {
      error?: string;
      summary?: StationCommunitySummary | null;
      mine?: MineContribution | null;
    };
    if (!res.ok) {
      throw new Error(data.error ?? "Could not save");
    }
    if (data.summary) setCommunitySummary(stationId, data.summary);
    applyMine(data.mine);
    if (flash === "price") {
      setPriceSaved(true);
      window.setTimeout(() => setPriceSaved(false), 2000);
    } else {
      setReviewSaved(true);
      window.setTimeout(() => setReviewSaved(false), 2000);
    }
  };

  const handlePriceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy("price");
    setPriceError(null);
    try {
      await postContribution(
        {
          stationId,
          kind: "price",
          fuelType,
          pricePerLitre: Number(price),
        },
        "price"
      );
    } catch (err) {
      setPriceError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(null);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy("review");
    setReviewError(null);
    try {
      await postContribution(
        {
          stationId,
          kind: "review",
          rating: rating === 0 ? null : rating,
          comment: comment.trim() || null,
        },
        "review"
      );
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(null);
    }
  };

  const handleClear = async (kind: SaveKind) => {
    if (busy) return;
    setBusy(kind === "price" ? "clear-price" : "clear-review");
    if (kind === "price") setPriceError(null);
    else setReviewError(null);
    try {
      await postContribution({ stationId, kind, clear: true }, kind);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not clear";
      if (kind === "price") setPriceError(msg);
      else setReviewError(msg);
    } finally {
      setBusy(null);
    }
  };

  const comments = community?.recentComments ?? [];
  const fuelLabel = fuelType.replace("_", " ");

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
                    {c.rating != null && <Stars value={c.rating} readOnly />}
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
          to report a pump price or leave a rating/comment on {stationName}.
        </p>
      ) : (
        <div className="space-y-3">
          {/* Price — independent of review */}
          <form
            onSubmit={handlePriceSubmit}
            className="space-y-2 rounded-lg border border-slate-800/80 bg-slate-950/30 p-2.5"
          >
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-300">
              <Fuel className="h-3.5 w-3.5 text-teal-400" />
              {hasPrice ? "Your reported price" : "Report pump price"}
            </p>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-slate-500">
                {fuelLabel} £/L
              </span>
              <input
                type="number"
                inputMode="decimal"
                step="0.001"
                min="0.8"
                max="3.5"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="1.349"
                className={cn(inputClass, "font-mono")}
              />
            </label>
            {priceError && (
              <p
                role="alert"
                className="rounded-lg border border-rose-800/50 bg-rose-950/40 px-2.5 py-1.5 text-[11px] text-rose-300"
              >
                {priceError}
              </p>
            )}
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={busy != null}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy === "price" && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                {priceSaved ? "Saved" : hasPrice ? "Update price" : "Submit price"}
              </button>
              {hasPrice && (
                <button
                  type="button"
                  onClick={() => void handleClear("price")}
                  disabled={busy != null}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-700/80 px-2.5 py-1.5 text-xs text-slate-400 transition hover:border-rose-700/50 hover:text-rose-300 disabled:opacity-60"
                  aria-label="Clear your price report"
                >
                  {busy === "clear-price" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
            </div>
          </form>

          {/* Rating / comment — independent of price */}
          <form
            onSubmit={handleReviewSubmit}
            className="space-y-2 rounded-lg border border-slate-800/80 bg-slate-950/30 p-2.5"
          >
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-300">
              <MessageSquare className="h-3.5 w-3.5 text-amber-400" />
              {hasReview ? "Your rating & comment" : "Rate & comment"}
            </p>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-slate-500">
                Rating
              </span>
              <Stars value={rating} onChange={setRating} />
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
            {reviewError && (
              <p
                role="alert"
                className="rounded-lg border border-rose-800/50 bg-rose-950/40 px-2.5 py-1.5 text-[11px] text-rose-300"
              >
                {reviewError}
              </p>
            )}
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={busy != null}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-amber-700/50 bg-amber-950/40 px-3 py-1.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-900/50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy === "review" && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                {reviewSaved
                  ? "Saved"
                  : hasReview
                    ? "Update review"
                    : "Submit review"}
              </button>
              {hasReview && (
                <button
                  type="button"
                  onClick={() => void handleClear("review")}
                  disabled={busy != null}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-700/80 px-2.5 py-1.5 text-xs text-slate-400 transition hover:border-rose-700/50 hover:text-rose-300 disabled:opacity-60"
                  aria-label="Clear your rating and comment"
                >
                  {busy === "clear-review" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
