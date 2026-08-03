import type { Metadata } from "next";
import { AccountSettings } from "@/app/components/AccountSettings";

export const metadata: Metadata = {
  title: "Account — PitstopIQ",
};

export default function AccountPage() {
  return <AccountSettings />;
}
