import type { Metadata } from "next";
import { AuthForm } from "@/app/components/AuthForm";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to PitstopIQ to sync vehicle presets and save trip places.",
  robots: { index: false, follow: true },
};

export default function LoginPage() {
  return <AuthForm mode="login" />;
}
