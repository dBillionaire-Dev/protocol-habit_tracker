import { requireAnyAdminPage } from "@/lib/admin/require-admin-page";
import { AdminShell } from "@/components/admin/admin-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, role } = await requireAnyAdminPage();
  return (
    <AdminShell adminEmail={user.email} adminRole={role}>
      {children}
    </AdminShell>
  );
}
