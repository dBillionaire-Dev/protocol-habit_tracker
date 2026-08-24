"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { StatCard } from "@/components/admin/stat-card";
import { useAdminRole } from "@/hooks/use-admin-role";

interface UserDetail {
  user: {
    id: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    status: "active" | "suspended";
    provider: string;
    referralCode: string | null;
    createdAt: string;
  };
  subscription: { plan: string; billingInterval: string | null; status: string | null } | null;
  habitCount: number;
  longestStreak: number;
  referredBy: { id: string; email: string | null } | null;
  referralCount: number;
}

async function fetchDetail(id: string): Promise<UserDetail> {
  const res = await fetch(`/api/admin/users/${id}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load user");
  return res.json();
}

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["admin-user", id], queryFn: () => fetchDetail(id) });
  const { data: me } = useAdminRole();
  const isSuperAdmin = me?.role === "super_admin";

  const [plan, setPlan] = useState("free");
  const [interval, setIntervalValue] = useState("monthly");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-user", id] });
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });
  };

  const suspendMutation = useMutation({
    mutationFn: () => fetch(`/api/admin/users/${id}/suspend`, { method: "POST", credentials: "include" }),
    onSuccess: invalidate,
  });
  const restoreMutation = useMutation({
    mutationFn: () => fetch(`/api/admin/users/${id}/restore`, { method: "POST", credentials: "include" }),
    onSuccess: invalidate,
  });
  const deleteMutation = useMutation({
    mutationFn: () => fetch(`/api/admin/users/${id}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => router.push("/admin/users"),
  });
  const changePlanMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/admin/users/${id}/plan`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, billingInterval: plan === "free" ? null : interval }),
      }),
    onSuccess: invalidate,
  });

  if (isLoading || !data) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  const { user, subscription } = data;
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || "Unnamed user";

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold tracking-tight">{name}</h1>
        <p className="text-muted-foreground">{user.email ?? "No email"}</p>
        <div className="flex gap-2 mt-2">
          <Badge variant={user.status === "suspended" ? "destructive" : "secondary"}>{user.status}</Badge>
          <Badge variant="outline" className="capitalize">
            {user.provider}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Plan" value={(subscription?.status === "active" ? subscription.plan : "free").replace("_", " ")} />
        <StatCard label="Habits" value={data.habitCount} />
        <StatCard label="Longest Streak" value={`${data.longestStreak}d`} />
        <StatCard label="Referrals Made" value={data.referralCount} />
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Account</h2>
        <p className="text-sm">Joined: {new Date(user.createdAt).toLocaleDateString()}</p>
        <p className="text-sm">Referral code: {user.referralCode ?? "\u2014"}</p>
        <p className="text-sm">
          Referred by: {data.referredBy ? (data.referredBy.email ?? data.referredBy.id) : "\u2014"}
        </p>
      </section>

      {isSuperAdmin && (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Actions</h2>
            <div className="flex flex-wrap gap-3">
              {user.status === "active" ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      Suspend account
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Suspend this account?</AlertDialogTitle>
                      <AlertDialogDescription>
                        {name} will be signed out of the app everywhere and unable to sign back in until restored.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => suspendMutation.mutate()}>Suspend</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <Button variant="outline" size="sm" onClick={() => restoreMutation.mutate()}>
                  Restore account
                </Button>
              )}

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    Delete account
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Permanently delete this account?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This deletes {name}&apos;s profile, habits, and history. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteMutation.mutate()}>Delete permanently</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </section>

          <section className="space-y-3 border-t border-border pt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Change plan (override)
            </h2>
            <p className="text-xs text-muted-foreground max-w-md">
              This only changes what PROTOCOL thinks this user&apos;s plan is -- it does not touch Paystack. Use
              for comps or support fixes, not to grant paid access without real payment. The next real Paystack
              webhook for this user overwrites this.
            </p>
            <div className="flex gap-3 items-center">
              <Select value={plan} onValueChange={setPlan}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="premium_plus">Premium Plus</SelectItem>
                </SelectContent>
              </Select>
              {plan !== "free" && (
                <Select value={interval} onValueChange={setIntervalValue}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <Button size="sm" onClick={() => changePlanMutation.mutate()} disabled={changePlanMutation.isPending}>
                Apply
              </Button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
