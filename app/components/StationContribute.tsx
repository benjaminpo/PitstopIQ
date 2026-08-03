"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Fuel, Loader2, MessageSquare, Star, Trash2 } from "lucide-react";
import { useSession } from "@/app/lib/auth-client";
import { ALL_FUEL_TYPES, FUEL_TYPE_LABELS } from "@/app/lib/fuelConstants";
import { formatPriceAge } from "@/app/lib/freshness";
import { usePitstopStore } from "@/app/lib/store";
import type { FuelType, StationCommunitySummary } from "@/app/lib/types";
import { cn } from "@/app/lib/utils";

type FuelPriceMap = Partial<Record<FuelType, number>>;

interface MineContribution {
  prices?: FuelPriceMap;
  /** @deprecated legacy single-grade fields */
  fuelType?: FuelType;
  pricePerLitre?: number | null;
  comment: string | null;
  rating: number | null;
}

const inputClass =
  "w-full rounded-lg border border-slate-700/80 bg-slate-950/60 px-2.5 py-1.5 text-sm text-slate-100 outline-none ring-teal-500/40 transition placeholder:text-slate-500 focus:border-teal-500/60 focus:ring-2";

function emptyPriceDrafts(): Record<FuelType, string> {
  return { E10: "", E5: "", B7_Diesel: "" };
}

function pricesFromMine(mine: MineContribution | null | undefined): FuelPriceMap {
  if (!mine) return {};
  if (mine.prices && Object.keys(mine.prices).length > 0) return mine.prices;
  if (mine.fuelType && mine.pricePerLitre != null) {
    return { [mine.fuelType]: mine.pricePerLitre };
  }
  return {};
}

function draftsFromPrices(prices: FuelPriceMap): Record<FuelType, string> {
  const drafts = emptyPriceDrafts();
  for (const t of ALL_FUEL_TYPES) {
    if (prices[t] != null) {
      drafts[t] = String(prices[t]);
    }
  }
  return drafts;
}

function Stars({
  value,
  onChange,
  readOnly,
}: Readonly<{
  value: number;
  onChange?: (n: number) => void;
  readOnly?: boolean;
}>) {
  if (readOnly) {
    return (
      <div className="flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            className={cn(
              "h-3.5 w-3.5",
              n <= value ? "fill-amber-400 text-amber-400" : "text-slate-600"
            )}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value;
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
type BusyState = SaveKind | "clear-price" | "clear-review" | null;

function commentDateLabel(updatedAt: number, now: number): {
  relative: string;
  absolute: string;
} | null {
  if (!Number.isFinite(updatedAt) || updatedAt <= 0) return null;
  return {
    relative: formatPriceAge(updatedAt, now),
    absolute: new Date(updatedAt).toLocaleString("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }),
  };
}

function CommunitySummaryBlock({
  community,
  comments,
}: Readonly<{
  community?: StationCommunitySummary;
  comments: StationCommunitySummary["recentComments"];
}>) {
  const [now] = useState(() => Date.now());
  const hasRatings = (community?.ratingCount ?? 0) > 0;
  if (!hasRatings && comments.length === 0) return null;

  return (
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
          {comments.map((c, i) => {
            const when = commentDateLabel(c.updatedAt, now);
            return (
              <li
                key={`${c.userName}-${c.updatedAt}-${i}`}
                className="rounded-lg bg-slate-950/50 px-2.5 py-2 text-[11px]"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex items-center gap-1.5">
                    <span className="truncate font-medium text-slate-300">
                      {c.userName}
                    </span>
                    {when && (
                      <time
                        dateTime={new Date(c.updatedAt).toISOString()}
                        title={when.absolute}
                        className="shrink-0 font-mono text-[10px] text-slate-500"
                      >
                        · {when.relative}
                      </time>
                    )}
                  </div>
                  {c.rating != null && <Stars value={c.rating} readOnly />}
                </div>
                <p className="mt-0.5 text-slate-400">{c.comment}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function priceSubmitLabel(saved: boolean, hasAnySaved: boolean): string {
  if (saved) return "Saved";
  if (hasAnySaved) return "Update prices";
  return "Submit prices";
}

function reviewSubmitLabel(saved: boolean, hasReview: boolean): string {
  if (saved) return "Saved";
  if (hasReview) return "Update review";
  return "Submit review";
}

function PriceForm({
  priceDrafts,
  setPriceDraft,
  savedPrices,
  officialPrices,
  priceError,
  priceSaved,
  busy,
  clearingFuel,
  onSubmit,
  onClearFuel,
}: Readonly<{
  priceDrafts: Record<FuelType, string>;
  setPriceDraft: (fuel: FuelType, value: string) => void;
  savedPrices: FuelPriceMap;
  officialPrices?: FuelPriceMap;
  priceError: string | null;
  priceSaved: boolean;
  busy: BusyState;
  clearingFuel: FuelType | null;
  onSubmit: (e: React.FormEvent) => void;
  onClearFuel: (fuel: FuelType) => void;
}>) {
  const hasAnySaved = ALL_FUEL_TYPES.some((t) => savedPrices[t] != null);

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-2 rounded-lg border border-slate-800/80 bg-slate-950/30 p-2.5"
    >
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-300">
        <Fuel className="h-3.5 w-3.5 text-teal-400" />
        {hasAnySaved ? "Your reported prices" : "Report pump prices"}
      </p>
      <p className="text-[10px] text-slate-500">
        Enter any grades you can confirm — leave the rest blank.
      </p>
      <div className="space-y-2">
        {ALL_FUEL_TYPES.map((fuel) => {
          const saved = savedPrices[fuel] != null;
          const official = officialPrices?.[fuel];
          return (
            <label key={fuel} className="flex flex-col gap-1">
              <span className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wide text-slate-500">
                <span>{FUEL_TYPE_LABELS[fuel]} £/L</span>
                {saved && (
                  <button
                    type="button"
                    onClick={() => onClearFuel(fuel)}
                    disabled={busy != null}
                    className="inline-flex items-center gap-1 rounded border border-transparent px-1 py-0.5 text-[10px] normal-case tracking-normal text-slate-500 transition hover:border-rose-700/50 hover:text-rose-300 disabled:opacity-60"
                    aria-label={`Clear ${FUEL_TYPE_LABELS[fuel]} price`}
                  >
                    {busy === "clear-price" && clearingFuel === fuel ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                    Clear
                  </button>
                )}
              </span>
              <input
                type="number"
                inputMode="decimal"
                step="0.001"
                min="0.8"
                max="3.5"
                value={priceDrafts[fuel]}
                onChange={(e) => setPriceDraft(fuel, e.target.value)}
                placeholder={
                  official != null ? official.toFixed(3) : "1.349"
                }
                className={cn(inputClass, "font-mono")}
              />
            </label>
          );
        })}
      </div>
      {priceError && (
        <p
          role="alert"
          className="rounded-lg border border-rose-800/50 bg-rose-950/40 px-2.5 py-1.5 text-[11px] text-rose-300"
        >
          {priceError}
        </p>
      )}
      <button
        type="submit"
        disabled={busy != null}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy === "price" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {priceSubmitLabel(priceSaved, hasAnySaved)}
      </button>
    </form>
  );
}

function ReviewForm({
  rating,
  setRating,
  comment,
  setComment,
  hasReview,
  reviewError,
  reviewSaved,
  busy,
  onSubmit,
  onClear,
}: Readonly<{
  rating: number;
  setRating: (n: number) => void;
  comment: string;
  setComment: (v: string) => void;
  hasReview: boolean;
  reviewError: string | null;
  reviewSaved: boolean;
  busy: BusyState;
  onSubmit: (e: React.FormEvent) => void;
  onClear: () => void;
}>) {
  return (
    <form
      onSubmit={onSubmit}
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
          {reviewSubmitLabel(reviewSaved, hasReview)}
        </button>
        {hasReview && (
          <button
            type="button"
            onClick={onClear}
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
  );
}

export function StationContribute({
  stationId,
  stationName,
  officialPrices,
  community,
}: Readonly<{
  stationId: string;
  stationName: string;
  officialPrices?: FuelPriceMap;
  community?: StationCommunitySummary;
}>) {
  const { data: session, isPending: sessionPending } = useSession();
  const setCommunitySummary = usePitstopStore((s) => s.setCommunitySummary);

  const [priceDrafts, setPriceDrafts] = useState(emptyPriceDrafts);
  const [savedPrices, setSavedPrices] = useState<FuelPriceMap>({});
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [mineLoaded, setMineLoaded] = useState(false);
  const [hasReview, setHasReview] = useState(false);
  const [busy, setBusy] = useState<BusyState>(null);
  const [clearingFuel, setClearingFuel] = useState<FuelType | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [priceSaved, setPriceSaved] = useState(false);
  const [reviewSaved, setReviewSaved] = useState(false);

  const setPriceDraft = (fuel: FuelType, value: string) => {
    setPriceDrafts((prev) => ({ ...prev, [fuel]: value }));
  };

  const applyMine = (mine: MineContribution | null | undefined) => {
    if (!mine) {
      setSavedPrices({});
      setHasReview(false);
      setPriceDrafts(draftsFromPrices({}));
      setRating(0);
      setComment("");
      return;
    }
    const prices = pricesFromMine(mine);
    setSavedPrices(prices);
    setHasReview(mine.rating != null || Boolean(mine.comment));
    setPriceDrafts(draftsFromPrices(prices));
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

    const prices: FuelPriceMap = {};
    for (const t of ALL_FUEL_TYPES) {
      const raw = priceDrafts[t].trim();
      if (!raw) continue;
      const n = Number(raw);
      if (!Number.isFinite(n)) {
        setPriceError(`Enter a valid ${FUEL_TYPE_LABELS[t]} price`);
        return;
      }
      prices[t] = n;
    }

    if (Object.keys(prices).length === 0) {
      setPriceError("Enter at least one fuel price");
      return;
    }

    setBusy("price");
    setPriceError(null);
    try {
      await postContribution(
        {
          stationId,
          kind: "price",
          prices,
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

  const handleClearFuel = async (fuel: FuelType) => {
    if (busy) return;
    setBusy("clear-price");
    setClearingFuel(fuel);
    setPriceError(null);
    try {
      await postContribution(
        { stationId, kind: "price", clear: true, fuelType: fuel },
        "price"
      );
    } catch (err) {
      setPriceError(err instanceof Error ? err.message : "Could not clear");
    } finally {
      setBusy(null);
      setClearingFuel(null);
    }
  };

  const handleClearReview = async () => {
    if (busy) return;
    setBusy("clear-review");
    setReviewError(null);
    try {
      await postContribution({ stationId, kind: "review", clear: true }, "review");
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "Could not clear");
    } finally {
      setBusy(null);
    }
  };

  const comments = community?.recentComments ?? [];

  let body: React.ReactNode;
  if (sessionPending || !mineLoaded) {
    body = (
      <p className="flex items-center gap-2 text-[11px] text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading member updates…
      </p>
    );
  } else if (!session) {
    body = (
      <p className="text-[11px] text-slate-400">
        <Link
          href="/login"
          className="font-medium text-teal-300 hover:text-teal-200"
        >
          Sign in
        </Link>{" "}
        to report pump prices or leave a rating/comment on {stationName}.
      </p>
    );
  } else {
    body = (
      <div className="space-y-3">
        <PriceForm
          priceDrafts={priceDrafts}
          setPriceDraft={setPriceDraft}
          savedPrices={savedPrices}
          officialPrices={officialPrices}
          priceError={priceError}
          priceSaved={priceSaved}
          busy={busy}
          clearingFuel={clearingFuel}
          onSubmit={(e) => void handlePriceSubmit(e)}
          onClearFuel={(fuel) => void handleClearFuel(fuel)}
        />
        <ReviewForm
          rating={rating}
          setRating={setRating}
          comment={comment}
          setComment={setComment}
          hasReview={hasReview}
          reviewError={reviewError}
          reviewSaved={reviewSaved}
          busy={busy}
          onSubmit={(e) => void handleReviewSubmit(e)}
          onClear={() => void handleClearReview()}
        />
      </div>
    );
  }

  return (
    <div className="mt-3 border-t border-slate-800/80 pt-3">
      <CommunitySummaryBlock community={community} comments={comments} />
      {body}
    </div>
  );
}
