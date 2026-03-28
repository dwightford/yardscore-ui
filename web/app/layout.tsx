import type { Metadata, Viewport } from "next";
import "./globals.css";
import FeedbackWidget from "./components/FeedbackWidget";

export const metadata: Metadata = {
  title: "YardScore",
  description: "Take a photo. Get a YardScore. See what to improve.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "YardScore",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#2d6a4f",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-screen bg-[#f8f4ef]">
        {/* diagnostic: visible on every route — if this text appears, the layout rendered */}
        <div id="ys-boot" style={{ fontSize: 10, textAlign: "center", color: "#ccc", letterSpacing: 1, padding: "2px 0" }}>ys:layout</div>
        {children}
        <FeedbackWidget />
      </body>
    </html>
  );
}
