import type { ReactNode } from "react";
import { cn } from "@/app/lib/utils";

interface DirectoryShellProps {
  children: ReactNode;
  /** Narrower max width for account / auth-style pages */
  width?: "default" | "narrow";
  className?: string;
  contentClassName?: string;
}

/** Shared atmospheric page chrome for browse / account surfaces. */
export function DirectoryShell({
  children,
  width = "default",
  className,
  contentClassName,
}: Readonly<DirectoryShellProps>) {
  return (
    <div
      className={cn(
        "relative min-h-dvh overflow-hidden bg-slate-950 text-slate-100",
        className
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(13,148,136,0.18),transparent_50%),radial-gradient(ellipse_at_80%_100%,rgba(14,116,144,0.12),transparent_45%)]"
      />
      <div
        className={cn(
          "relative z-10 mx-auto flex w-full flex-col gap-5 px-4 py-6 sm:gap-6 sm:px-6 sm:py-8",
          width === "narrow" ? "max-w-lg" : "max-w-6xl",
          contentClassName
        )}
      >
        {children}
      </div>
    </div>
  );
}
