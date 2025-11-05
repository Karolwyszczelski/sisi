"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";

// opcjonalnie Supabase; jeśli brak env albo brak rekordu, pokaż fallback
let supabase: any = null;
try {
  const { createClient } = require("@supabase/supabase-js");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key) supabase = createClient(url, key);
} catch {}

type Ann = {
  id: string;
  text: string;
  link_href: string | null;
  active: boolean;
  show_from: string | null;
  show_to: string | null;
  dismiss_key: string | null;
  theme: "red" | "black" | "yellow" | null;
};

const FALLBACK: Ann = {
  id: "fallback-30",
  text: "PROMO -30% NA CAŁE MENU! Kod: SISI30. Tylko do 30 listopada!",
  link_href: "/#menu",
  active: true,
  show_from: null,
  show_to: "2025-11-30T23:59:59+01:00",
  dismiss_key: "sisi-30-list",
  theme: "red",
};

export default function PromoTicker() {
  const [ann, setAnn] = useState<Ann | null>(null);

  // localStorage dismisser
  const dismissed = useMemo(() => {
    const k = ann?.dismiss_key || "promo";
    try { return localStorage.getItem(`dismiss:${k}`) === "1"; } catch { return false; }
  }, [ann?.dismiss_key]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // 1) Spróbuj Supabase
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from("site_announcements")
            .select("id,text,link_href,active,show_from,show_to,dismiss_key,theme")
            .eq("active", true)
            .lte("show_from", new Date().toISOString())
            .gte("show_to", new Date().toISOString())
            .order("show_from", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!cancelled && !error && data) {
            setAnn(data as Ann);
            return;
          }
        } catch {}
      }
      // 2) Fallback do 30 listopada
      if (!cancelled) setAnn(FALLBACK);
    }

    load();
    return () => { cancelled = true; };
  }, []);

  if (!ann) return null;

  // czy po dacie?
  if (ann.show_to && new Date(ann.show_to).getTime() < Date.now()) return null;
  if (dismissed) return null;

  const bg =
    ann.theme === "black" ? "bg-black" :
    ann.theme === "yellow" ? "bg-yellow-400 text-black" :
    "bg-red-600";

  const handleClose = () => {
    try { localStorage.setItem(`dismiss:${ann.dismiss_key || "promo"}`, "1"); } catch {}
    setAnn(null);
  };

  return (
    <div
      className={clsx(
        "fixed top-0 left-0 right-0 z-[9999] select-none",
        bg,
        "text-white"
      )}
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
