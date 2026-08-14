import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/app/components/LegalPage";
import { SITE_NAME } from "@/app/lib/site";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: `Cookies and similar technologies used by ${SITE_NAME}.`,
  alternates: { canonical: "/cookies" },
};

export default function CookiesPage() {
  return (
    <LegalPage title="Cookie Policy" updated="13 August 2026">
      <p>
        This page describes cookies and similar storage used by {SITE_NAME}. It
        should be read with the{" "}
        <Link href="/privacy" className="text-teal-400 hover:text-teal-300">
          Privacy Policy
        </Link>
        .
      </p>

      <h2>Necessary cookies</h2>
      <p>
        Session cookies keep you signed in. They are required for accounts,
        saved vehicles, recent places, and station watches. The site cannot
        offer those features without them.
      </p>

      <h2>Local device storage</h2>
      <p>
        The planner may store trip settings, map state, and similar preferences
        in your browser. That data stays on your device unless you sign in and
        sync it.
      </p>

      <h2>Analytics</h2>
      <p>
        If Google Analytics is enabled, Google may set cookies to measure how
        the site is used. Those cookies are not required to compare fuel
        prices.
      </p>

      <h2>Advertising</h2>
      <p>
        If Google AdSense is enabled, Google and its partners may use cookies
        to show ads and measure them. See Google&apos;s{" "}
        <a
          href="https://policies.google.com/technologies/ads"
          className="text-teal-400 hover:text-teal-300"
          rel="noopener noreferrer"
          target="_blank"
        >
          advertising policy
        </a>{" "}
        and{" "}
        <a
          href="https://www.google.com/settings/ads"
          className="text-teal-400 hover:text-teal-300"
          rel="noopener noreferrer"
          target="_blank"
        >
          Ads Settings
        </a>{" "}
        for more.
      </p>

      <h2>How to control cookies</h2>
      <p>
        You can block or delete cookies in your browser. Blocking necessary
        cookies will sign you out. Blocking analytics or ad cookies does not
        stop the route planner from working.
      </p>
    </LegalPage>
  );
}
