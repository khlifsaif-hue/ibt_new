import type { Metadata } from "next";
import "./globals.css";
import "./functionality.css";
import "./mobile-overview.css";
import "./ui-polish.css";
import { SmartCareRouteBoundary } from "./components/smartcare-route-boundary";

export const metadata: Metadata = {
  title: "Ibtechar SmartCare V3_02",
  description: "AI-powered technical maintenance and asset management.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <SmartCareRouteBoundary>{children}</SmartCareRouteBoundary>
      </body>
    </html>
  );
}
