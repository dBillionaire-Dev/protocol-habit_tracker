import { requireAdminPage } from "@/lib/admin/require-admin-page";
import { AdminShell } from "@/components/admin/admin-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminPage();
  return <AdminShell adminEmail={admin.email}>{children}</AdminShell>;
}
