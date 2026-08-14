import type { ReactNode } from "react";
import Link from "next/link";
import { DirectoryHeader } from "@/app/components/DirectoryHeader";
import { DirectoryShell } from "@/app/components/DirectoryShell";
import { LEGAL_NAV } from "@/app/lib/site";

interface LegalPageProps {
  title: string;
  updated: string;
  children: ReactNode;
}

/** Shared chrome for privacy, terms, and cookie policy pages. */
export function LegalPage({
  title,
  updated,
  children,
}: Readonly<LegalPageProps>) {
  return (
    <DirectoryShell contentClassName="max-w-3xl">
      <DirectoryHeader
        title={title}
        description={`Last updated ${updated}.`}
        hideNav
      />
      <article className="space-y-4 text-sm leading-relaxed text-slate-300 [&_h2]:pt-4 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-white [&_li]:mt-1 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        {children}
      </article>
      <nav
        aria-label="Other legal pages"
        className="flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-800/80 pt-4 text-xs text-slate-500"
      >
        {LEGAL_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="transition hover:text-slate-300"
          >
            {item.title}
          </Link>
        ))}
      </nav>
    </DirectoryShell>
  );
}
