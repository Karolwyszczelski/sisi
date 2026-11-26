"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  applyGoogleConsent,
  ensureGoogleDataLayer,
  loadGoogleTagManager,
  readCookieConsent,
  trackEvent,
} from "@/lib/analytics";

export default function GoogleTagManager() {
  const pathname = usePathname();
  const firstPath = useRef(true);

  useEffect(() => {
    ensureGoogleDataLayer();
    const consent = readCookieConsent();
    if (consent) applyGoogleConsent(consent);
    if (consent?.analytics) loadGoogleTagManager();

    const trackContactClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const link = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!link) return;
      const href = link.href;

      if (href.startsWith("tel:")) {
        trackEvent("contact", { contact_method: "phone" });
      } else if (href.startsWith("mailto:")) {
        trackEvent("contact", { contact_method: "email" });
      } else if (href.includes("maps.app.goo.gl") || href.includes("google.com/maps")) {
        trackEvent("get_directions", { location_name: "SISI Burger & Pancakes" });
      } else if (href.includes("facebook.com") || href.includes("instagram.com")) {
        trackEvent("social_click", { social_network: href.includes("facebook.com") ? "facebook" : "instagram" });
      }
    };

    document.addEventListener("click", trackContactClick, true);
    return () => document.removeEventListener("click", trackContactClick, true);
  }, []);

  useEffect(() => {
    if (firstPath.current) {
      firstPath.current = false;
      return;
    }
    trackEvent("page_view", {
      page_path: pathname,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [pathname]);

  return null;
}
