import type { Metadata, Viewport } from "next";
import { requireAnyAdminPage } from "@/lib/admin/require-admin-page";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminAppShell } from "@/components/admin-app-shell";

// Per-segment metadata override (Next.js merges this over the root
// layout's metadata for every route under /admin) — this is what gives
// "Protocol Admin" its own distinct installable-PWA identity: its own
// name, icons, and manifest, rather than inheriting the main app's.
// theme-color differs too (the admin red accent), via the separate
// `viewport` export below.
export const metadata: Metadata = {
  title: "Protocol Admin",
  manifest: "/admin-manifest.json",
  icons: {
    icon: "/admin-favicon.svg",
    apple: "/admin-apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Protocol Admin",
  },
};

export const viewport: Viewport = {
  themeColor: "#b91c1c",
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, role } = await requireAnyAdminPage();
  return (
    <AdminAppShell>
      <AdminShell adminEmail={user.email} adminRole={role}>
        {children}
      </AdminShell>
    </AdminAppShell>
  );
}
