// sw.js (v1)
const DEFAULT_URL = "/admin/current-orders";
const DEFAULT_ICON = "/hamburger.png";
const DEFAULT_BADGE = "/favicon.ico";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Minimalny fetch handler (lepsza kompatybilność i stabilniejsze "installability" na części urządzeń)
self.addEventListener("fetch", (event) => {
  // nie ruszamy non-GET
  if (!event.request || event.request.method !== "GET") return;

  // brak cache'owania, po prostu przepuszczamy request
  event.respondWith(fetch(event.request));
});

self.addEventListener("push", (event) => {
  let data = {};

  // event.data.json() potrafi się wywalić gdy payload to tekst
  try {
    if (event.data) {
      const text = event.data.text();
      try {
        data = JSON.parse(text);
      } catch {
        // fallback: spróbuj json()
        try { data = event.data.json(); } catch { data = {}; }
      }
    }
  } catch {
    data = {};
  }

  const title = data.title || "Nowe zamówienie";
  const body = data.body || "Pojawiło się nowe zamówienie.";
  const url = data.url || DEFAULT_URL;

  const options = {
    body,
    icon: data.icon || DEFAULT_ICON,
    badge: data.badge || DEFAULT_BADGE,

    // zachowanie notyfikacji (desktop zwykle “wisi” do kliknięcia)
    tag: data.tag || "sisi-new-order",
    renotify: true,
    requireInteraction: true,
    vibrate: [120, 60, 120],

    data: { url, ...(data.data && typeof data.data === "object" ? data.data : {}) },

    actions: Array.isArray(data.actions)
      ? data.actions
      : [{ action: "open", title: "Otwórz" }],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification?.data?.url || "/";
  const target = new URL(url, self.location.origin);

  event.waitUntil((async () => {
    const wins = await clients.matchAll({ type: "window", includeUncontrolled: true });

    // 1) jeśli jest otwarta karta z tej samej origin -> fokus + nawigacja
    for (const w of wins) {
      try {
        const wUrl = new URL(w.url);
        if (wUrl.origin === target.origin) {
          await w.focus();
          if ("navigate" in w && wUrl.href !== target.href) {
            await w.navigate(target.href);
          }
          return;
        }
      } catch {}
    }

    // 2) inaczej otwórz nowe okno
    await clients.openWindow(target.href);
  })());
});
