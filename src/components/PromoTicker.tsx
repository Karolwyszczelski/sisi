"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";

let supabase: any = null;
try {
  const { createClient } = require("@supabase/supabase-js");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key) supabase = createClient(url, key);
} catch {}

type Banner = {
  id: string;
  title: string | null;
  body: string | null;
  url: string | null;
  enabled: boolean;
  starts_at: string | null;
  ends_at: string | null;
  dismiss_hours: number | null;
  bg: string | null;
  fg: string | null;
};

type Ann = {
  id: string;
  text: string;
  link_href: string | null;
  dismiss_key: string | null;
  bg: string;
  fg: string;
  dismiss_hours?: number | null;
};

const FALLBACK: Ann = {
  id: "fallback-10",
  text: "PROMO -10% NA CAŁE MENU! Zamów teraz!",
  link_href: "/#menu",
  dismiss_key: "sisi-10",
  bg: "#de1d13",
  fg: "#ffffff",
  dismiss_hours: 24,
};

export default function PromoTicker() {
  const [ann, setAnn] = useState<Ann | null>(null);

  // sprawdź, czy użytkownik już zamknął ten konkretny baner
  const dismissed = useMemo(() => {
    if (!ann) return false;
    const key = ann.dismiss_key || ann.id;
    try {
      const raw = localStorage.getItem(`dismiss:${key}`);
      if (!raw) return false;
      const { at, hours } = JSON.parse(raw) as {
        at: number;
        hours: number | null;
      };
      if (!hours || hours <= 0) return true; // bezterminowo
      const diff = Date.now() - at;
      return diff < hours * 60 * 60 * 1000;
    } catch {
      return false;
    }
  }, [ann]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const now = new Date();

      // 1) spróbuj pobrać z promo_banners
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from("promo_banners")
            .select(
              "id, enabled, title, body, url, starts_at, ends_at, dismiss_hours, bg, fg, priority"
            )
            .eq("enabled", true)
            .order("priority", { ascending: false })
            .order("starts_at", { ascending: false });

          if (!error && data && data.length) {
            const list = data as Banner[];

            const active = list.find((b) => {
              if (!b.enabled) return false;
              const from = b.starts_at ? new Date(b.starts_at) : null;
              const to = b.ends_at ? new Date(b.ends_at) : null;
              if (from && from > now) return false;
              if (to && to < now) return false;
              return true;
            });

            if (!cancelled && active) {
              setAnn({
                id: active.id,
                text: active.title || active.body || "",
                link_href: active.url,
                dismiss_key: active.id,
                bg: active.bg || "#de1d13",
                fg: active.fg || "#ffffff",
                dismiss_hours: active.dismiss_hours,
              });
              return;
            }
          }
        } catch {
          // w razie błędu – lecimy na fallback
        }
      }

      // 2) Fallback, jeśli nic z bazy
      if (!cancelled) {
        setAnn(FALLBACK);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ann) return null;
  if (dismissed) return null;

  const handleClose = () => {
    try {
      const key = ann.dismiss_key || ann.id;
      localStorage.setItem(
        `dismiss:${key}`,
        JSON.stringify({
          at: Date.now(),
          hours: ann.dismiss_hours ?? 24,
        })
      );
    } catch {}
    setAnn(null);
  };

  const bgClass = "bg-[color:var(--promo-bg)]";
  const fgClass = "text-[color:var(--promo-fg)]";

  return (
    <div
      className={clsx(
        "fixed top-0 left-0 right-0 z-[9999] select-none",
        bgClass,
        fgClass
      )}
      style={{
        ["--promo-bg" as any]: ann.bg,
        ["--promo-fg" as any]: ann.fg,
      }}
      role="status"
    >
      {/* Desktop */}
      <div className="hidden sm:flex mx-auto max-w-7xl px-4 py-2.5 items-center justify-center gap-4">
        <div className="flex items-center gap-2">
          <span className="animate-pulse">🔥</span>
          <span className="font-bold tracking-wide">{ann.text}</span>
        </div>
        {ann.link_href && (
          <a
            href={ann.link_href}
            className="inline-flex items-center gap-1.5 px-4 py-1 bg-white/20 hover:bg-white/30 rounded-full text-sm font-bold transition-all hover:scale-105"
          >
            ZAMÓW TERAZ
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </a>
        )}
        <button
          aria-label="Ukryj komunikat"
          onClick={handleClose}
          className="absolute right-4 w-7 h-7 flex items-center justify-center rounded-full bg-black/20 hover:bg-black/30 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      {/* Mobile */}
      <div className="sm:hidden flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="animate-pulse text-sm">🔥</span>
          <span className="font-bold text-xs truncate">{ann.text}</span>
        </div>
        {ann.link_href && (
          <a
            href={ann.link_href}
            className="flex-shrink-0 ml-2 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-full text-xs font-bold transition-all"
          >
            ZAMÓW
          </a>
        )}
        <button
          aria-label="Ukryj komunikat"
          onClick={handleClose}
          className="flex-shrink-0 ml-2 w-6 h-6 flex items-center justify-center rounded-full bg-black/20 hover:bg-black/30 transition-colors"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
