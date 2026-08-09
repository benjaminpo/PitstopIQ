import type { Metadata } from "next";
import { AuthForm } from "@/app/components/AuthForm";

export const metadata: Metadata = {
  title: "Create account",
  description:
    "Create a PitstopIQ account to sync vehicle presets and recent places across devices.",
  robots: { index: false, follow: true },
};

export default function RegisterPage() {
  return <AuthForm mode="register" />;
}
