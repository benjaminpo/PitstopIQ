import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { GoogleAdSense } from "@/app/components/GoogleAdSense";
import { GoogleAnalytics } from "@/app/components/GoogleAnalytics";
import { getAdSenseClient } from "@/app/lib/adsense";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
  resolveSiteUrl,
} from "@/app/lib/site";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const siteUrl = resolveSiteUrl();

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#020617",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "UK fuel prices",
    "Fuel Finder",
    "cheap petrol",
    "cheap diesel",
    "route fuel cost",
    "detour calculator",
    "MPG fuel saving",
    "forecourt comparison",
  ],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: siteUrl,
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  category: "travel",
  ...(getAdSenseClient()
    ? {
        other: {
          "google-adsense-account": getAdSenseClient()!,
        },
      }
    : {}),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-GB" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-dvh bg-slate-950 font-sans text-slate-100 antialiased`}
      >
        {children}
        <GoogleAnalytics />
        <GoogleAdSense />
      </body>
    </html>
  );
}
