import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "./providers";
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
      <body className="min-h-screen bg-[#07110c]">
        <Providers>
          {children}
          <FeedbackWidget />
        </Providers>
      </body>
    </html>
  );
}
