"use client";

import React, { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: any) => void;
      reset: (el?: any) => void;
    };
    onloadTurnstileCallback?: () => void;
  }
}

type Props = {
  siteKey?: string;
  onVerify: (token: string) => void;
  onExpire?: () => void;
  theme?: "light" | "dark" | "auto";
  action?: string;        // np. "order"
};

export default function TurnstileWidget({
  siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || process.env.TURNSTILE_SITE_KEY || "",
  onVerify,
  onExpire,
  theme = "auto",
  action = "order",
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const render = () => {
      if (!ref.current || !window.turnstile) return;
      window.turnstile.render(ref.current, {
        sitekey: siteKey,
        theme,
        action,
        callback: (token: string) => onVerify(token),
        "expired-callback": () => onExpire?.(),
        "timeout-callback": () => onExpire?.(),
        retry: "auto",
      });
    };

    // jeśli skrypt już jest
    if (window.turnstile) {
      render();
      return;
    }

    // doładuj skrypt
    const id = "cf-turnstile-script";
    if (!document.getElementById(id)) {
      const s = document.createElement("script");
      s.id = id;
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback";
      s.async = true;
      s.defer = true;
      document.head.appendChild(s);
    }

    window.onloadTurnstileCallback = () => render();

    return () => {
      // nic — Turnstile sam sprząta instancje
    };
  }, [siteKey, theme, action, onVerify, onExpire]);

  return <div ref={ref} className="cf-turnstile" />;
}
