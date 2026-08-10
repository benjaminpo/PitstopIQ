import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { AccountMenu } from "@/app/components/AccountMenu";
import { AppLogo } from "@/app/components/AppLogo";
import {
  DirectoryNav,
  type DirectoryNavKey,
} from "@/app/components/DirectoryNav";
import { cn } from "@/app/lib/utils";

interface DirectoryHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  backHref?: string;
  backLabel?: string;
  /** Which directory section is current (also inferred from pathname) */
  current?: DirectoryNavKey | null;
  /** Extra controls beside DirectoryNav (e.g. FreshnessBadge) */
  trailing?: ReactNode;
  /** Hide the Stations / Locations / Brands nav */
  hideNav?: boolean;
  /** Show logo above the title (default true) */
  showLogo?: boolean;
  className?: string;
  children?: ReactNode;
}

export function DirectoryHeader({
  title,
  description,
  backHref = "/",
  backLabel = "Back to planner",
  current,
  trailing,
  hideNav = false,
  showLogo = true,
  className,
  children,
}: Readonly<DirectoryHeaderProps>) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-start justify-between gap-4",
        className
      )}
    >
      <div className="min-w-0 flex-1 space-y-3">
        {showLogo && (
          <Link href="/" aria-label="PitstopIQ home">
            <AppLogo />
          </Link>
        )}
        <div>
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 transition hover:text-slate-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {backLabel}
          </Link>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">
            {title}
          </h1>
          {description && (
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-400">
              {description}
            </p>
          )}
        </div>
        {children}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {!hideNav && <DirectoryNav current={current} icons={false} />}
        {trailing}
        <AccountMenu />
      </div>
    </header>
  );
}
