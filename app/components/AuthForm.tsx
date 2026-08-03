"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { AppLogo } from "@/app/components/AppLogo";
import { signIn, signUp } from "@/app/lib/auth-client";
import { joinDisplayName } from "@/app/lib/userName";

const inputClass =
  "w-full rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none ring-teal-500/40 transition placeholder:text-slate-500 focus:border-teal-500/60 focus:ring-2";

export function AuthForm({ mode }: Readonly<{ mode: "login" | "register" }>) {
  const router = useRouter();
  const isRegister = mode === "register";

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    const name = joinDisplayName(firstName, lastName);
    if (isRegister && !name) {
      setError("Enter at least a first or last name.");
      setSubmitting(false);
      return;
    }

    const result = isRegister
      ? await signUp.email({ name, email, password })
      : await signIn.email({ email, password });

    if (result.error) {
      setError(
        result.error.message ??
          (isRegister ? "Could not create account" : "Could not sign in")
      );
      setSubmitting(false);
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <div className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden bg-slate-950 px-4 py-10 text-slate-100">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(13,148,136,0.18),transparent_50%),radial-gradient(ellipse_at_80%_100%,rgba(14,116,144,0.12),transparent_45%)]"
      />

      <div className="relative z-10 w-full max-w-sm">
        <Link
          href="/"
          className="mb-6 flex items-center justify-center gap-2"
          aria-label="Back to PitstopIQ"
        >
          <AppLogo size="md" wordmarkClassName="text-xl" />
        </Link>

        <div className="rounded-2xl border border-slate-800/80 bg-slate-950/95 p-6 shadow-2xl shadow-slate-950/60 backdrop-blur-md">
          <h1 className="text-lg font-semibold text-white">
            {isRegister ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            {isRegister
              ? "Save your trips and vehicle profiles across devices."
              : "Sign in to access your saved trips and vehicles."}
          </p>

          <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
            {isRegister && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-slate-300">
                    First name
                  </span>
                  <input
                    type="text"
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Alex"
                    className={inputClass}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-slate-300">
                    Last name
                  </span>
                  <input
                    type="text"
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Driver"
                    className={inputClass}
                  />
                </label>
              </div>
            )}

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-slate-300">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={inputClass}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-slate-300">
                Password
              </span>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isRegister ? "At least 8 characters" : "••••••••"}
                  className={`${inputClass} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 transition hover:text-slate-300"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </label>

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-rose-800/50 bg-rose-950/40 px-3 py-2 text-xs text-rose-300"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-1 flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-teal-950/50 transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isRegister ? "Create account" : "Sign in"}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-slate-400">
            {isRegister ? (
              <>
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="font-medium text-teal-300 transition hover:text-teal-200"
                >
                  Sign in
                </Link>
              </>
            ) : (
              <>
                New to PitstopIQ?{" "}
                <Link
                  href="/register"
                  className="font-medium text-teal-300 transition hover:text-teal-200"
                >
                  Create an account
                </Link>
              </>
            )}
          </p>
        </div>

        <p className="mt-4 text-center text-[11px] text-slate-500">
          <Link href="/" className="transition hover:text-slate-300">
            ← Continue without an account
          </Link>
        </p>
      </div>
    </div>
  );
}
