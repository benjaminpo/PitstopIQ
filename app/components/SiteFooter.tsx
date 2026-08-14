import Link from "next/link";
import { LEGAL_NAV } from "@/app/lib/site";
import { cn } from "@/app/lib/utils";

interface SiteFooterProps {
  className?: string;
}

/** Compact privacy / terms / cookies links for planner, directory, and auth. */
export function SiteFooter({ className }: Readonly<SiteFooterProps>) {
  return (
    <nav
      aria-label="Legal"
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-500",
        className
      )}
    >
      {LEGAL_NAV.map((item, index) => (
        <span key={item.href} className="inline-flex items-center gap-2">
          {index > 0 ? <span aria-hidden="true">·</span> : null}
          <Link
            href={item.href}
            className="transition hover:text-slate-300"
          >
            {item.label}
          </Link>
        </span>
      ))}
    </nav>
  );
}
