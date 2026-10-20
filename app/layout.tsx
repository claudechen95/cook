import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cook",
  description: "Turn any Instagram cooking video into a recipe.",
  // Installed to the iOS home screen, this opens full-screen without browser chrome.
  appleWebApp: {
    capable: true,
    title: "Cook",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  // Lets the bottom nav's env(safe-area-inset-bottom) clear the home indicator.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white">{children}</body>
    </html>
  );
}
