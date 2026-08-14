import { cn } from "@/app/lib/utils";

type AppLogoSize = "sm" | "md" | "lg";

const SIZE: Record<AppLogoSize, string> = {
  sm: "h-8 w-8",
  md: "h-9 w-9",
  lg: "h-10 w-10",
};

interface AppLogoProps {
  size?: AppLogoSize;
  showWordmark?: boolean;
  className?: string;
  wordmarkClassName?: string;
}

/**
 * PitstopIQ brand mark — map pin with fuel droplet.
 */
export function AppLogo({
  size = "sm",
  showWordmark = true,
  className,
  wordmarkClassName,
}: Readonly<AppLogoProps>) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        className={cn(
          "relative shrink-0 overflow-hidden rounded-lg shadow-md shadow-teal-950/50",
          SIZE[size]
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- local SVG brand mark */}
        <img
          src="/brand/mark.svg"
          alt="PitstopIQ"
          width={36}
          height={36}
          className="h-full w-full"
          decoding="async"
        />
      </span>
      {showWordmark ? (
        <span
          aria-hidden="true"
          className={cn(
            "text-lg font-bold tracking-tight text-white",
            wordmarkClassName
          )}
        >
          Pitstop<span className="text-teal-400">IQ</span>
        </span>
      ) : null}
    </span>
  );
}
