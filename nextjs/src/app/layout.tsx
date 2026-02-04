import type { Metadata, Viewport } from "next";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { queryClient } from "@/lib/queryClient";
import { ServiceWorkerProvider } from "@/components/service-worker-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Protocol - Personal Habit Tracker",
    template: "%s | Protocol",
  },
  description: "A serious framework for tracking habits. Build consistent habits, track your progress, and achieve your goals with Protocol.",
  keywords: ["habit tracker", "habit tracking", "productivity", "goal setting", "self improvement", "daily habits", "streaks", "PWA"],
  authors: [{ name: "Ebenezer (NexDev)" }],
  creator: "NexDev",
  publisher: "Ebenezer | NexDev",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://protocol.app",
    siteName: "Protocol",
    title: "Protocol - Personal Habit Tracker",
    description: "A serious framework for tracking habits. Build consistent habits, track your progress, and achieve your goals.",
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "Protocol - Personal Habit Tracker",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Protocol - Personal Habit Tracker",
    description: "A serious framework for tracking habits. Build consistent habits, track your progress, and achieve your goals.",
    images: ["/og-image.svg"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
  manifest: "/manifest.json",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Protocol" />
        <meta name="msapplication-TileColor" content="#000000" />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <ServiceWorkerProvider>
          <QueryClientProvider client={queryClient}>
            <TooltipProvider>
              <Toaster />
              {children}
            </TooltipProvider>
          </QueryClientProvider>
        </ServiceWorkerProvider>
      </body>
    </html>
  );
}
