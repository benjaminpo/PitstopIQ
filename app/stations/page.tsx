import type { Metadata } from "next";
import { StationsDirectory } from "@/app/components/StationsDirectory";

export const metadata: Metadata = {
  title: "All stations",
  description:
    "Browse UK Fuel Finder petrol and diesel stations with live prices, sorting, and filters.",
};

export default function StationsPage() {
  return <StationsDirectory />;
}
