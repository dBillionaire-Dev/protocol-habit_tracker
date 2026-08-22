"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, isGuestMode } from "@/lib/api";
import type { NotificationPreferences, NotificationCategory } from "shared/schema";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// Permission state as the browser reports it — "default" means never
// asked (or asked and dismissed without a definitive choice, depending
// on the browser). Only "granted" means we can actually subscribe;
// "denied" must never be re-prompted (browsers ignore/block a second
// Notification.requestPermission() call after a denial anyway, so this
// is also just how the platform behaves, not only a design choice).
export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const request = useCallback(async () => {
    if (!("Notification" in window)) return "unsupported" as const;
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  return { permission, request };
}

// Subscribes/unsubscribes THIS browser (see the pushSubscriptions table
// comment in shared/schema.ts — one row per device) via the Push API,
// then syncs that subscription to our server so it knows where to send
// future pushes. Not available in guest mode — see api/push/subscribe's
// route comment for why.
export function usePushSubscription() {
  const queryClient = useQueryClient();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (isGuestMode() || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setChecked(true);
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setIsSubscribed(!!sub))
      .finally(() => setChecked(true));
  }, []);

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) throw new Error("Push notifications aren't configured yet.");

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        // Cast needed because TS's lib.dom typings for BufferSource are
        // stricter about ArrayBuffer vs. the more general ArrayBufferLike
        // than the Push API actually requires at runtime — a plain
        // Uint8Array works fine in every browser.
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });

      const res = await apiFetch("/api/push/subscribe", {
        method: "POST",
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!res.ok) {
        // Roll back the browser-side subscription if the server didn't
        // accept it — otherwise the browser thinks it's subscribed but
        // no server-side row exists to ever actually send to.
        await subscription.unsubscribe().catch(() => {});
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to subscribe");
      }
      setIsSubscribed(true);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/preferences"] });
    },
  });

  const unsubscribeMutation = useMutation({
    mutationFn: async () => {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await apiFetch("/api/push/unsubscribe", {
          method: "POST",
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setIsSubscribed(false);
    },
  });

  return {
    isSubscribed,
    isChecked: checked,
    subscribe: subscribeMutation.mutate,
    isSubscribing: subscribeMutation.isPending,
    subscribeError: subscribeMutation.error,
    unsubscribe: unsubscribeMutation.mutate,
    isUnsubscribing: unsubscribeMutation.isPending,
  };
}

export function useNotificationPreferences() {
  return useQuery<NotificationPreferences>({
    queryKey: ["/api/notifications/preferences"],
    queryFn: async () => {
      const res = await apiFetch("/api/notifications/preferences");
      if (!res.ok) throw new Error("Failed to load notification preferences");
      return res.json();
    },
    enabled: !isGuestMode(),
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (updates: Partial<Record<NotificationCategory, boolean>>) => {
      const res = await apiFetch("/api/notifications/preferences", {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update preferences");
      return res.json() as Promise<NotificationPreferences>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/notifications/preferences"], data);
    },
  });
}
