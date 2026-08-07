import type { Metadata } from "next";
import localFont from "next/font/local";
import { GoogleAdSense } from "@/app/components/GoogleAdSense";
import { GoogleAnalytics } from "@/app/components/GoogleAnalytics";
import { getAdSenseClient } from "@/app/lib/adsense";
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

export const metadata: Metadata = {
  title: "PitstopIQ — Smart Route Cost Calculator",
  description:
    "Calculate whether diverting to a cheaper fuel station is a net financial gain, accounting for MPG, detour distance, and live forecourt prices.",
  applicationName: "PitstopIQ",
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
