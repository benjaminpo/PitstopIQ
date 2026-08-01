import type { Metadata } from "next";
import { AuthForm } from "@/app/components/AuthForm";

export const metadata: Metadata = {
  title: "Sign in — PitstopIQ",
};

export default function LoginPage() {
  return <AuthForm mode="login" />;
}
