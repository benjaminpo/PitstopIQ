import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/app/components/LegalPage";
import { SITE_CONTACT_URL, SITE_NAME } from "@/app/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `Terms for using the ${SITE_NAME} UK fuel route cost calculator.`,
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="13 August 2026">
      <p>
        These terms cover use of {SITE_NAME}. The app is provided free of
        charge, as is. If you do not agree, do not use the site.
      </p>

      <h2>What {SITE_NAME} does</h2>
      <p>
        {SITE_NAME} helps you compare UK Fuel Finder petrol and diesel prices
        along a route. It estimates whether a cheaper forecourt is worth the
        extra miles and time. Figures are estimates, not a guarantee.
      </p>

      <h2>Price data</h2>
      <p>
        Prices come from the UK Government Fuel Finder service and optional
        contributor updates. They can be stale, incomplete, or wrong. Always
        check the pump price before you fill up.
      </p>

      <h2>Accounts</h2>
      <p>
        You must provide accurate details if you create an account. Keep your
        password secret. We may suspend accounts used to abuse the service.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>Do not scrape, overload, or reverse-engineer the service.</li>
        <li>Do not submit false station reports or prices on purpose.</li>
        <li>Do not use the site for anything unlawful.</li>
      </ul>

      <h2>Ads and third parties</h2>
      <p>
        The site may show Google ads. Links to maps, Fuel Finder, or other
        sites are outside our control.         Their terms apply when you leave {SITE_NAME}.
      </p>

      <h2>Liability</h2>
      <p>
        We are not liable for missed savings, extra fuel used, late arrivals, or
        reliance on a displayed price. Nothing in these terms limits liability
        that UK law does not allow us to limit.
      </p>

      <h2>Privacy</h2>
      <p>
        How we handle personal data is described in the{" "}
        <Link href="/privacy" className="text-teal-400 hover:text-teal-300">
          Privacy Policy
        </Link>
        .
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms can be raised at{" "}
        <Link
          href={SITE_CONTACT_URL}
          className="text-teal-400 hover:text-teal-300"
        >
          the {SITE_NAME} GitHub repository
        </Link>
        .
      </p>
    </LegalPage>
  );
}
