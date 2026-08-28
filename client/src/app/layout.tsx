import type { Metadata, Viewport } from "next";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { queryClient } from "@/lib/queryClient";
import { ServiceWorkerProvider } from "@/components/service-worker-provider";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";
import { AppShell } from "@/components/app-shell";
import "./globals.css";
export const metadata: Metadata = {
  metadataBase: new URL('https://protocol-nex.vercel.app'),
  title: {
    default: "Protocol - Personal Discipline System",
    template: "%s | Protocol",
  },
  description: "A serious framework for tracking habits. Build consistent habits, track your progress, and achieve your goals with Protocol.",
  keywords: ["habit tracker", "habit tracking", "productivity", "goal setting", "self improvement", "daily habits", "streaks", "PWA", "discipline", "goal tracking", "discipline system"],
  authors: [{ name: "Ebenezer (NexDev)" }],
  creator: "NexDev",
  publisher: "Ebenezer | NexDev",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://protocol-nex.vercel.app",
    siteName: "Protocol",
    title: "Protocol - Personal Discipline System",
    description: "A serious framework for tracking habits. Build consistent habits, track your progress, and achieve your goals.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Protocol - Personal Discipline System",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Protocol - Personal Discipline System",
    description: "A serious framework for tracking habits. Build consistent habits, track your progress, and achieve your goals.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Protocol",
  },
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
};
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Deliberately NOT hardcoding <link rel="manifest">,
            apple-mobile-web-app-capable/status-bar-style/title here
            anymore -- they used to be raw JSX, which (since only the
            root layout can render <head> at all) meant they were
            ALWAYS present on every page, including /admin, alongside
            whatever nested layouts like app/admin/layout.tsx declared
            via the Metadata API. That produced two competing <link
            rel="manifest"> tags (and two apple-mobile-web-app-title
            tags) on /admin, with undefined/inconsistent
            browser-dependent resolution -- which is exactly why
            installing "Protocol Admin" from /admin was being detected
            as "already installed" and opening the main Protocol app
            instead. Expressing these via the `metadata` object above
            (manifest, appleWebApp) instead lets Next.js's per-segment
            metadata merging actually override them correctly for
            nested routes, producing exactly one of each tag. */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#000000" />

        {/* iOS static launch screens -- no animation is possible before
            JS loads, so these show first; sized/matched so the splash's
            opening frame (shield + big "P") continues seamlessly from
            whichever one the device picks via these media queries. */}
        <link rel="apple-touch-startup-image" href="/ios-launch/apple-splash-640-1136.png" media="screen and (device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/ios-launch/apple-splash-750-1334.png" media="screen and (device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/ios-launch/apple-splash-828-1792.png" media="screen and (device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/ios-launch/apple-splash-1242-2688.png" media="screen and (device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/ios-launch/apple-splash-1125-2436.png" media="screen and (device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/ios-launch/apple-splash-1170-2532.png" media="screen and (device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/ios-launch/apple-splash-1179-2556.png" media="screen and (device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/ios-launch/apple-splash-1284-2778.png" media="screen and (device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/ios-launch/apple-splash-1290-2796.png" media="screen and (device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/ios-launch/apple-splash-1536-2048.png" media="screen and (device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/ios-launch/apple-splash-1620-2160.png" media="screen and (device-width: 810px) and (device-height: 1080px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/ios-launch/apple-splash-1668-2224.png" media="screen and (device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/ios-launch/apple-splash-1668-2388.png" media="screen and (device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/ios-launch/apple-splash-2048-2732.png" media="screen and (device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <ServiceWorkerProvider>
          <QueryClientProvider client={queryClient}>
            <TooltipProvider>
              <AppShell>
                <Toaster />
                {children}
                <PWAInstallPrompt />
              </AppShell>
            </TooltipProvider>
          </QueryClientProvider>
        </ServiceWorkerProvider>
      </body>
    </html>
  );
}
