"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, BellOff, BellRing, Check, X, AlertTriangle, Send, Loader2 } from "lucide-react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function isStandaloneMode() {
  return (typeof navigator !== "undefined" && (navigator as { standalone?: boolean }).standalone === true)
    || (typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)")?.matches);
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iOS = /iPad|iPhone|iPod/i.test(ua);
  const iPadOS = navigator.platform === "MacIntel" && (navigator as { maxTouchPoints?: number }).maxTouchPoints !== undefined && (navigator as { maxTouchPoints?: number }).maxTouchPoints! > 1;
  return iOS || iPadOS;
}

type Props = {
  className?: string;
  compact?: boolean;
  showTestButton?: boolean;
  isDark?: boolean;
};

export default function PushNotificationControl({ className, compact = false, showTestButton = true, isDark = true }: Props) {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  const [supported, setSupported] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [subscribed, setSubscribed] = useState<boolean>(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [testSent, setTestSent] = useState(false);

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

    const ok =
      typeof window !== "undefined" &&
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window;

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
    const existing = await navigator.serviceWorker.getRegistration("/");
    if (existing) return existing;

    const reg = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });

    await navigator.serviceWorker.ready;
    return reg;
  }, []);

  const enable = useCallback(async () => {
    setBusy(true);
    setError(null);

    try {
      if (ios && !standalone) {
        throw new Error("iOS wymaga PWA - dodaj stronę do ekranu początkowego");
      }

      if (!vapidPublicKey) throw new Error("Brak klucza VAPID");

      if (typeof window === "undefined" || !("Notification" in window)) {
        throw new Error("Przeglądarka nie obsługuje powiadomień");
      }

      if (!window.isSecureContext) {
        throw new Error("Wymagane jest HTTPS");
      }

      const reg = await ensureSW();

      if (!navigator.serviceWorker.controller) {
        throw new Error("Odśwież stronę i spróbuj ponownie");
      }

      let perm: NotificationPermission = Notification.permission;

      if (perm === "default") {
        perm = await Notification.requestPermission();
      }

      setPermission(perm);

      if (perm === "denied") {
        throw new Error("Powiadomienia są zablokowane w przeglądarce");
      }

      if (perm === "default") {
        throw new Error("Nie udzielono zgody na powiadomienia");
      }

      const existingSub = await reg.pushManager.getSubscription();
      if (existingSub) {
        const res = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(existingSub),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || "Błąd zapisu subskrypcji");
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
        throw new Error(body?.error || "Błąd zapisu subskrypcji");
      }

      setSubscribed(true);
    } catch (e: unknown) {
      setError((e as Error)?.message || "Nieznany błąd");
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
        await fetch("/api/push/subscribe/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch (e: unknown) {
      setError((e as Error)?.message || "Błąd wyłączania");
    } finally {
      setBusy(false);
      await refreshState();
    }
  }, [refreshState]);

  const test = useCallback(async () => {
    setBusy(true);
    setError(null);
    setTestSent(false);
    try {
      const res = await fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Test powiadomień",
          body: "Powiadomienia działają poprawnie! 🎉",
          url: "/admin/pickup-order",
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Błąd wysyłania testu");
      }
      setTestSent(true);
      setTimeout(() => setTestSent(false), 3000);
    } catch (e: unknown) {
      setError((e as Error)?.message || "Błąd testu");
    } finally {
      setBusy(false);
    }
  }, []);

  // Status info
  const status = useMemo(() => {
    if (supported === false) return { type: "unsupported", label: "Brak wsparcia", color: "gray" };
    if (permission === "denied") return { type: "blocked", label: "Zablokowane", color: "red" };
    if (subscribed) return { type: "active", label: "Aktywne", color: "green" };
    return { type: "inactive", label: "Nieaktywne", color: "yellow" };
  }, [permission, subscribed, supported]);

  // Compact mode - just icon button
  if (compact) {
    return (
      <div className={`relative ${className || ""}`}>
        <button
          onClick={() => setShowTooltip(!showTooltip)}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors relative ${
            status.type === "active"
              ? isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-600"
              : status.type === "blocked"
              ? isDark ? "bg-rose-500/20 text-rose-400" : "bg-rose-100 text-rose-600"
              : isDark ? "bg-slate-800 text-slate-400 hover:bg-slate-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          {status.type === "active" ? (
            <BellRing className="w-5 h-5" />
          ) : status.type === "blocked" ? (
            <BellOff className="w-5 h-5" />
          ) : (
            <Bell className="w-5 h-5" />
          )}
          {status.type === "active" && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
          )}
        </button>

        {/* Tooltip/Dropdown */}
        {showTooltip && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowTooltip(false)} />
            <div className={`absolute right-0 top-12 z-50 w-72 rounded-xl border shadow-xl p-4 ${
              isDark ? "bg-slate-800 border-slate-700" : "bg-white border-gray-200"
            }`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className={`font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>Powiadomienia</h3>
                <button onClick={() => setShowTooltip(false)} className={isDark ? "text-slate-400 hover:text-white" : "text-gray-400 hover:text-gray-900"}>
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Status indicator */}
              <div className={`flex items-center gap-2 p-3 rounded-lg mb-3 ${
                status.type === "active" 
                  ? isDark ? "bg-emerald-500/10" : "bg-emerald-50"
                  : status.type === "blocked"
                  ? isDark ? "bg-rose-500/10" : "bg-rose-50"
                  : isDark ? "bg-slate-700/50" : "bg-gray-50"
              }`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  status.type === "active" 
                    ? isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-600"
                    : status.type === "blocked"
                    ? isDark ? "bg-rose-500/20 text-rose-400" : "bg-rose-100 text-rose-600"
                    : isDark ? "bg-slate-600 text-slate-400" : "bg-gray-200 text-gray-500"
                }`}>
                  {status.type === "active" ? <Check className="w-4 h-4" /> : status.type === "blocked" ? <X className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                </div>
                <div>
                  <p className={`text-sm font-medium ${
                    status.type === "active" 
                      ? isDark ? "text-emerald-400" : "text-emerald-700"
                      : status.type === "blocked"
                      ? isDark ? "text-rose-400" : "text-rose-700"
                      : isDark ? "text-slate-300" : "text-gray-700"
                  }`}>{status.label}</p>
                  <p className={`text-xs ${isDark ? "text-slate-500" : "text-gray-500"}`}>
                    {status.type === "active" && "Będziesz otrzymywać powiadomienia"}
                    {status.type === "blocked" && "Odblokuj w ustawieniach przeglądarki"}
                    {status.type === "inactive" && "Włącz by otrzymywać alerty"}
                    {status.type === "unsupported" && "Ta przeglądarka nie obsługuje Web Push"}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                {status.type === "active" ? (
                  <>
                    {showTestButton && (
                      <button
                        onClick={test}
                        disabled={busy}
                        className={`w-full h-10 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
                          testSent
                            ? "bg-emerald-500 text-white"
                            : isDark 
                              ? "bg-slate-700 text-slate-300 hover:bg-slate-600" 
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : testSent ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                        {testSent ? "Wysłano!" : "Wyślij test"}
                      </button>
                    )}
                    <button
                      onClick={disable}
                      disabled={busy}
                      className={`w-full h-10 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
                        isDark ? "text-rose-400 hover:bg-rose-500/10" : "text-rose-600 hover:bg-rose-50"
                      }`}
                    >
                      <BellOff className="w-4 h-4" />
                      Wyłącz powiadomienia
                    </button>
                  </>
                ) : status.type !== "blocked" && status.type !== "unsupported" ? (
                  <button
                    onClick={enable}
                    disabled={busy || (ios && !standalone)}
                    className="w-full h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center gap-2 text-sm font-semibold hover:bg-emerald-500 transition-colors disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                    Włącz powiadomienia
                  </button>
                ) : null}
              </div>

              {/* iOS warning */}
              {ios && !standalone && (
                <p className={`mt-3 text-xs ${isDark ? "text-amber-400" : "text-amber-600"}`}>
                  📱 iOS: Dodaj stronę do ekranu początkowego
                </p>
              )}

              {/* Error */}
              {error && (
                <div className={`mt-3 p-2 rounded-lg text-xs flex items-start gap-2 ${isDark ? "bg-rose-500/10 text-rose-400" : "bg-rose-50 text-rose-600"}`}>
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  {error}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  // Full mode
  return (
    <div className={`rounded-xl border p-4 ${isDark ? "bg-slate-800/50 border-slate-700" : "bg-white border-gray-200"} ${className || ""}`}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          status.type === "active" 
            ? isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-600"
            : status.type === "blocked"
            ? isDark ? "bg-rose-500/20 text-rose-400" : "bg-rose-100 text-rose-600"
            : isDark ? "bg-slate-700 text-slate-400" : "bg-gray-100 text-gray-500"
        }`}>
          {status.type === "active" ? <BellRing className="w-5 h-5" /> : status.type === "blocked" ? <BellOff className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className={`font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>Powiadomienia Push</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              status.type === "active" 
                ? isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-700"
                : status.type === "blocked"
                ? isDark ? "bg-rose-500/20 text-rose-400" : "bg-rose-100 text-rose-700"
                : isDark ? "bg-slate-600 text-slate-400" : "bg-gray-100 text-gray-600"
            }`}>
              {status.label}
            </span>
          </div>
          
          <p className={`text-sm mb-3 ${isDark ? "text-slate-400" : "text-gray-600"}`}>
            {status.type === "active" && "Otrzymujesz powiadomienia o nowych zamówieniach"}
            {status.type === "blocked" && "Odblokuj w ustawieniach przeglądarki"}
            {status.type === "inactive" && "Włącz by otrzymywać alerty o nowych zamówieniach"}
            {status.type === "unsupported" && "Ta przeglądarka nie obsługuje Web Push"}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            {status.type === "active" ? (
              <>
                {showTestButton && (
                  <button
                    onClick={test}
                    disabled={busy}
                    className={`h-9 px-4 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors ${
                      testSent
                        ? "bg-emerald-500 text-white"
                        : isDark 
                          ? "bg-slate-700 text-slate-300 hover:bg-slate-600" 
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : testSent ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                    {testSent ? "Wysłano!" : "Testuj"}
                  </button>
                )}
                <button
                  onClick={disable}
                  disabled={busy}
                  className={`h-9 px-4 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors ${
                    isDark ? "text-rose-400 hover:bg-rose-500/10" : "text-rose-600 hover:bg-rose-50"
                  }`}
                >
                  <BellOff className="w-4 h-4" />
                  Wyłącz
                </button>
              </>
            ) : status.type !== "blocked" && status.type !== "unsupported" ? (
              <button
                onClick={enable}
                disabled={busy || (ios && !standalone)}
                className="h-9 px-4 rounded-lg bg-emerald-600 text-white flex items-center gap-2 text-sm font-semibold hover:bg-emerald-500 transition-colors disabled:opacity-50"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                Włącz powiadomienia
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* iOS warning */}
      {ios && !standalone && (
        <p className={`mt-3 text-xs ${isDark ? "text-amber-400" : "text-amber-600"}`}>
          📱 iOS/iPadOS: Dodaj stronę do ekranu początkowego i otwórz z ikony
        </p>
      )}

      {/* Error */}
      {error && (
        <div className={`mt-3 p-3 rounded-lg text-sm flex items-start gap-2 ${isDark ? "bg-rose-500/10 text-rose-400" : "bg-rose-50 text-rose-600"}`}>
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}
    </div>
  );
}
