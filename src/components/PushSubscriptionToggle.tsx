"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function isStandaloneMode() {
  // iOS Safari (PWA) + standard display-mode
  // @ts-ignore
  return (typeof navigator !== "undefined" && (navigator as any).standalone === true)
    || (typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)")?.matches);
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iOS = /iPad|iPhone|iPod/i.test(ua);
  const iPadOS = navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1;
  return iOS || iPadOS;
}

type Props = {
  className?: string;
  showTestButton?: boolean;
};

export default function PushSubscriptionToggle({ className, showTestButton = true }: Props) {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  const [supported, setSupported] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [subscribed, setSubscribed] = useState<boolean>(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const standalone = useMemo(() => {
    if (typeof window === "undefined") return false;
    return isStandaloneMode();
  }, []);

  const ios = useMemo(() => {
    if (typeof window === "undefined") return false;
    return isIOS();
  }, []);

  const refreshState = useCallback(async () => {
    setError(null);

    const ok = typeof window !== "undefined"
      && "Notification" in window
      && "serviceWorker" in navigator
      && "PushManager" in window;

    setSupported(ok);

    if (!ok) {
      setPermission("unsupported");
      setSubscribed(false);
      return;
    }

    setPermission(Notification.permission);

    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      if (!reg) {
        setSubscribed(false);
        return;
      }
      const sub = await reg.pushManager.getSubscription();
      setSubscribed(!!sub);
    } catch {
      setSubscribed(false);
    }
  }, []);

  useEffect(() => {
    void refreshState();
  }, [refreshState]);

  const ensureSW = useCallback(async () => {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    return reg;
  }, []);

  const enable = useCallback(async () => {
    setBusy(true);
    setError(null);

    try {
      if (ios && !standalone) {
        throw new Error(
          "iOS/iPadOS: Web Push działa dopiero po dodaniu strony do ekranu początkowego (PWA) i uruchomieniu z ikony."
        );
      }

      if (!vapidPublicKey) throw new Error("Brak NEXT_PUBLIC_VAPID_PUBLIC_KEY w env.");

      if (typeof window === "undefined" || !("Notification" in window)) {
        throw new Error("Brak obsługi Notification API w tej przeglądarce.");
      }

      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm === "denied") {
        throw new Error(
          "Powiadomienia są ZABLOKOWANE dla tej witryny. Odblokuj je w ustawieniach przeglądarki/systemu i spróbuj ponownie."
        );
      }
      if (perm !== "granted") {
        throw new Error("Nie przyznano uprawnień do powiadomień.");
      }

      const reg = await ensureSW();

      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        const res = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(existing),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || "Backend nie zapisał subskrypcji (existing).");
        }

        setSubscribed(true);
        return;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Nie udało się zapisać subskrypcji w bazie.");
      }

      setSubscribed(true);
    } catch (e: any) {
      setError(e?.message || "Nieznany błąd.");
    } finally {
      setBusy(false);
      await refreshState();
    }
  }, [ensureSW, refreshState, vapidPublicKey, ios, standalone]);

  const disable = useCallback(async () => {
    setBusy(true);
    setError(null);

    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch (e: any) {
      setError(e?.message || "Nie udało się wyłączyć powiadomień.");
    } finally {
      setBusy(false);
      await refreshState();
    }
  }, [refreshState]);

  const test = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Test • SISI",
          body: "Jeśli to widzisz, Web Push działa.",
          url: "/admin/pickup-order",
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Nie udało się wysłać testu.");
      }
    } catch (e: any) {
      setError(e?.message || "Błąd testu.");
    } finally {
      setBusy(false);
    }
  }, []);

  const label = useMemo(() => {
    if (supported === false) return "Brak wsparcia";
    if (permission === "denied") return "Zablokowane w przeglądarce";
    if (subscribed) return "Powiadomienia: WŁĄCZONE";
    return "Powiadomienia: WYŁĄCZONE";
  }, [permission, subscribed, supported]);

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        {!subscribed ? (
          <button
            className="h-10 rounded-md bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            onClick={enable}
            disabled={busy || supported === false || (ios && !standalone)}
            title={ios && !standalone ? "iOS/iPadOS: dodaj stronę do ekranu początkowego (PWA) i uruchom z ikony." : undefined}
          >
            Włącz powiadomienia
          </button>
        ) : (
          <button
            className="h-10 rounded-md bg-slate-800 px-4 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
            onClick={disable}
            disabled={busy}
          >
            Wyłącz
          </button>
        )}

        {showTestButton && (
          <button
            className="h-10 rounded-md border px-4 text-sm disabled:opacity-50"
            onClick={test}
            disabled={busy || !subscribed}
            title={!subscribed ? "Włącz powiadomienia, aby wysłać test." : undefined}
          >
            Test
          </button>
        )}

        <span className="text-xs text-slate-600">{label}</span>
      </div>

      {ios && !standalone && (
        <p className="mt-1 text-xs text-slate-500">
          iOS/iPadOS: Web Push działa dopiero po dodaniu strony do ekranu początkowego (PWA) i uruchomieniu z ikony.
        </p>
      )}

      {permission === "denied" && (
        <p className="mt-1 text-xs text-amber-700">
          Powiadomienia są zablokowane dla tej witryny. Odblokuj je w ustawieniach przeglądarki (uprawnienia witryny) lub w ustawieniach systemu.
        </p>
      )}

      {error && (
        <p className="mt-1 text-xs text-rose-600">{error}</p>
      )}
    </div>
  );
}
