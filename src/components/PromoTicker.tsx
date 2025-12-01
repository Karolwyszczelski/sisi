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
  text: "PROMO -10% NA CAŁE MENU! Tylko do 30 grudnia!",
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
        // Tailwind nie lubi dynamicznych kolorów, więc lecimy przez CSS custom props
        ["--promo-bg" as any]: ann.bg,
        ["--promo-fg" as any]: ann.fg,
      }}
      role="status"
    >
      <div className="mx-auto max-w-7xl px-3 sm:px-4 py-2 text-center text-sm font-semibold flex items-center justify-center gap-3">
        <span>{ann.text}</span>
        {ann.link_href ? (
          <a
            href={ann.link_href}
            className="underline underline-offset-2 decoration-2"
          >
            ZAMÓW
          </a>
        ) : null}
        <button
          aria-label="Ukryj komunikat"
          onClick={handleClose}
          className="ml-2 rounded px-2 py-0.5 bg-white/15 hover:bg-white/25"
        >
          ×
        </button>
      </div>
    </div>
  );
}
