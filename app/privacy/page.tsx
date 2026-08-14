import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/app/components/LegalPage";
import { SITE_CONTACT_URL, SITE_NAME } from "@/app/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${SITE_NAME} collects, uses, and stores personal data.`,
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="13 August 2026">
      <p>
        {SITE_NAME} is an independent UK fuel comparison web app. This policy
        explains what we collect and why. It is not legal advice.
      </p>

      <h2>Who we are</h2>
      <p>
        The operator of {SITE_NAME} is the controller of personal data processed
        through this site. For privacy requests, open an issue at{" "}
        <Link
          href={SITE_CONTACT_URL}
          className="text-teal-400 hover:text-teal-300"
        >
          the {SITE_NAME} GitHub repository
        </Link>
        .
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          Account details if you register: name, email address, and a hashed
          password.
        </li>
        <li>
          Optional saved data: vehicle presets, recent places, and station
          watches.
        </li>
        <li>
          Technical logs that hosting providers may keep: IP address, browser
          type, and request times.
        </li>
      </ul>

      <h2>Location and routing</h2>
      <p>
        Start, destination, and “use my location” stay in your browser for
        routing. We do not sell location data. A search may be stored on your
        device as a recent place if you are signed in and choose to sync.
      </p>

      <h2>Fuel prices</h2>
      <p>
        Forecourt prices and station details come from the UK Government Fuel
        Finder service. That dataset is not personal data about you.
      </p>

      <h2>Cookies, analytics, and ads</h2>
      <p>
        Session cookies keep you signed in. If Google Analytics or Google
        AdSense is enabled, those services may set their own cookies. See the{" "}
        <Link href="/cookies" className="text-teal-400 hover:text-teal-300">
          Cookie Policy
        </Link>{" "}
        for details.
      </p>

      <h2>Why we use this data</h2>
      <ul>
        <li>To provide the route planner and signed-in features.</li>
        <li>To keep the site secure and working.</li>
        <li>To understand usage and, where ads are shown, to fund the service.</li>
      </ul>

      <h2>How long we keep it</h2>
      <p>
        Account data is kept until you delete the account. Server logs are kept
        only as long as the host retains them. You can ask us to erase account
        data.
      </p>

      <h2>Your rights</h2>
      <p>
        If UK GDPR applies, you can ask for access, correction, erasure,
        restriction, or a copy of your data. You can also complain to the ICO.
      </p>

      <h2>Changes</h2>
      <p>
        We may update this policy. The date at the top is the latest version.
      </p>
    </LegalPage>
  );
}
