"use client";

import { useState } from "react";
import {
  brandFaviconUrl,
  resolveBrandLogo,
  type BrandLogoInfo,
} from "@/app/lib/brandLogo";
import { cn } from "@/app/lib/utils";

const SIZE_CLASSES = {
  sm: "h-5 w-5 text-[9px]",
  md: "h-7 w-7 text-[11px]",
  lg: "h-9 w-9 text-xs",
} as const;

const PIXEL_SIZE = {
  sm: 64,
  md: 128,
  lg: 128,
} as const;

export type BrandLogoSize = keyof typeof SIZE_CLASSES;

interface BrandLogoProps {
  /** Forecourt brand name (or brand key label) */
  brand: string;
  size?: BrandLogoSize;
  className?: string;
  /** Hide decorative meaning from AT — parent already names the brand */
  decorative?: boolean;
}

function Lettermark({
  info,
  size,
  className,
  decorative,
}: Readonly<{
  info: BrandLogoInfo;
  size: BrandLogoSize;
  className?: string;
  decorative?: boolean;
}>) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md font-bold leading-none tracking-tight",
        SIZE_CLASSES[size],
        className
      )}
      style={{ backgroundColor: info.bg, color: info.fg }}
      aria-hidden={decorative ? true : undefined}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : `${info.label} logo`}
      title={info.label}
    >
      {info.initials}
    </span>
  );
}

function logoSrc(info: BrandLogoInfo, size: BrandLogoSize): string | null {
  if (info.src) return info.src;
  if (info.domain) return brandFaviconUrl(info.domain, PIXEL_SIZE[size]);
  return null;
}

/**
 * Brand mark for a fuel forecourt — local asset or favicon when known,
 * coloured lettermark otherwise.
 */
export function BrandLogo({
  brand,
  size = "md",
  className,
  decorative = true,
}: Readonly<BrandLogoProps>) {
  const info = resolveBrandLogo(brand);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = logoSrc(info, size);
  const imageFailed = Boolean(src && failedSrc === src);

  if (!src || imageFailed) {
    return (
      <Lettermark
        info={info}
        size={size}
        className={className}
        decorative={decorative}
      />
    );
  }

  const isLocal = Boolean(info.src);

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 overflow-hidden rounded-md bg-white ring-1 ring-black/10",
        SIZE_CLASSES[size],
        className
      )}
      aria-hidden={decorative ? true : undefined}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : `${info.label} logo`}
      title={info.label}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- remote favicon or local SVG; lettermark fallback on error */}
      <img
        src={src}
        alt=""
        width={PIXEL_SIZE[size]}
        height={PIXEL_SIZE[size]}
        className="h-full w-full object-contain p-0.5"
        loading="lazy"
        decoding="async"
        onError={() => setFailedSrc(src)}
        onLoad={(e) => {
          // Skip size check for bundled SVGs; Google often returns tiny stubs
          if (isLocal) return;
          const img = e.currentTarget;
          if (img.naturalWidth < 48 || img.naturalHeight < 48) {
            setFailedSrc(src);
          }
        }}
      />
    </span>
  );
}
