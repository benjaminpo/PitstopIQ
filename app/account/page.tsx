import type { Metadata } from "next";
import { AccountSettings } from "@/app/components/AccountSettings";

export const metadata: Metadata = {
  title: "Account",
  description: "Manage your PitstopIQ account settings.",
  robots: { index: false, follow: false },
};

export default function AccountPage() {
  return <AccountSettings />;
}
