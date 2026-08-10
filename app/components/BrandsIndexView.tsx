import Link from "next/link";
import { BrandLogo } from "@/app/components/BrandLogo";
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
  groupBrandsByCategory,
  type BrandSummary,
} from "@/app/lib/brandsDirectory";

interface BrandsIndexViewProps {
  brands: BrandSummary[];
  stationCount: number;
  source: "live" | "mock";
}

export function BrandsIndexView({
  brands,
  stationCount,
  source,
}: Readonly<BrandsIndexViewProps>) {
  const groups = groupBrandsByCategory(brands);

  return (
    <DirectoryShell>
      <DirectoryHeader
        current="brands"
        title="UK fuel station brands"
        description="Compare live Fuel Finder petrol and diesel prices by brand — supermarket, oil majors, motorway operators, and independents."
      />

      <DirectoryMetaBar>
        <p className="text-xs text-slate-500">
          {brands.length.toLocaleString()} brands ·{" "}
          {stationCount.toLocaleString()} stations
          {source === "mock" ? " · demo data" : ""}
        </p>
        <nav aria-label="Jump to category" className="flex flex-wrap gap-1.5">
          {groups.map((group) => (
            <DirectoryJumpChip key={group.category} href={`#${group.category}`}>
              {group.label.replace(/ brands$/i, "")}
            </DirectoryJumpChip>
          ))}
        </nav>
      </DirectoryMetaBar>

      <div className="space-y-10 pb-10">
        {groups.map((group) => (
          <section key={group.category} id={group.category}>
            <DirectorySectionHeading count={group.brands.length}>
              {group.label}
            </DirectorySectionHeading>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {group.brands.map((brand) => (
                <li key={brand.key}>
                  <Link href={brand.href} className={directoryCardClassName()}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-start gap-2.5">
                        <BrandLogo brand={brand.label} size="md" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-100 transition group-hover:text-teal-100">
                            {brand.label}
                          </p>
                          <DirectoryStationCount count={brand.stationCount} />
                        </div>
                      </div>
                      <DirectoryCardChevron />
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 border-t border-slate-800/80 pt-2.5 text-[11px]">
                      <div>
                        <p className="text-slate-500">E10 from</p>
                        <p className="mt-0.5 font-mono text-sm font-semibold text-teal-200">
                          {formatDirectoryPrice(brand.cheapestE10)}
                        </p>
                        <p className="text-slate-600">
                          avg {formatDirectoryPrice(brand.averageE10)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">Diesel from</p>
                        <p className="mt-0.5 font-mono text-sm font-semibold text-slate-100">
                          {formatDirectoryPrice(brand.cheapestDiesel)}
                        </p>
                        <p className="text-slate-600">
                          avg {formatDirectoryPrice(brand.averageDiesel)}
                        </p>
                      </div>
                    </div>
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
