import Link from "next/link";
import { DirectoryHeader } from "@/app/components/DirectoryHeader";
import { DirectoryShell } from "@/app/components/DirectoryShell";
import {
  DirectoryCardChevron,
  DirectoryJumpChip,
  DirectoryMetaBar,
  DirectorySectionHeading,
  DirectoryStationCount,
  directoryCardClassName,
  formatDirectoryPrice,
} from "@/app/components/DirectoryUi";
import {
  groupLocationAreasByLetter,
  type LocationAreaSummary,
} from "@/app/lib/locationsDirectory";

interface LocationsIndexViewProps {
  areas: LocationAreaSummary[];
  stationCount: number;
  source: "live" | "mock";
}

export function LocationsIndexView({
  areas,
  stationCount,
  source,
}: Readonly<LocationsIndexViewProps>) {
  const groups = groupLocationAreasByLetter(areas);

  return (
    <DirectoryShell>
      <DirectoryHeader
        current="locations"
        title="Fuel prices by location"
        description="Browse UK Fuel Finder forecourts by postcode area — like a local price checker for petrol and diesel near you."
      />

      <DirectoryMetaBar>
        <p className="text-xs text-slate-500">
          {areas.length.toLocaleString()} areas ·{" "}
          {stationCount.toLocaleString()} stations
          {source === "mock" ? " · demo data" : ""}
        </p>
        <nav aria-label="Jump to letter" className="flex flex-wrap gap-1.5">
          {groups.map((group) => (
            <DirectoryJumpChip
              key={group.letter}
              href={`#letter-${group.letter}`}
              square
            >
              {group.letter}
            </DirectoryJumpChip>
          ))}
        </nav>
      </DirectoryMetaBar>

      <div className="space-y-8 pb-10">
        {groups.map((group) => (
          <section key={group.letter} id={`letter-${group.letter}`}>
            <DirectorySectionHeading>{group.letter}</DirectorySectionHeading>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {group.areas.map((area) => (
                <li key={area.key}>
                  <Link href={area.href} className={directoryCardClassName()}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-100 transition group-hover:text-teal-100">
                          {area.label}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {area.area}
                          {area.sampleTown ? ` · ${area.sampleTown}` : ""}
                        </p>
                        <DirectoryStationCount count={area.stationCount} />
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="shrink-0 rounded-md bg-teal-500/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-teal-200 ring-1 ring-teal-500/35">
                          {formatDirectoryPrice(area.cheapestPrice)}
                        </span>
                        <DirectoryCardChevron />
                      </div>
                    </div>
                    <p className="border-t border-slate-800/80 pt-2.5 text-[11px] text-slate-500">
                      E10 from · tap for all grades
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </DirectoryShell>
  );
}
