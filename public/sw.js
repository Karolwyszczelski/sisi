// sw.js (v2)
const DEFAULT_URL = "/admin/pickup-order";
const DEFAULT_ICON = "/android-chrome-192x192.png";
const DEFAULT_BADGE = "/favicon.ico";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Minimalny fetch handler (lepsza kompatybilnosc i stabilniejsze "installability" na czesci urzadzen)
self.addEventListener("fetch", (event) => {
  // nie ruszamy non-GET
  if (!event.request || event.request.method !== "GET") return;

  // brak cacheowania, po prostu przepuszczamy request
  event.respondWith(fetch(event.request));
});

self.addEventListener("push", (event) => {
  let data = {};

  // event.data.json() potrafi sie wywalic gdy payload to tekst
  try {
    if (event.data) {
      const text = event.data.text();
      try {
        data = JSON.parse(text);
      } catch {
        // fallback: sprobuj json()
        try { data = event.data.json(); } catch { data = {}; }
      }
    }
  } catch {
    data = {};
  }

  const title = data.title || "Nowe zamowienie";
  const body = data.body || "Pojawilo sie nowe zamowienie.";
  const url = data.url || DEFAULT_URL;

  const options = {
    body,
    icon: data.icon || DEFAULT_ICON,
    badge: data.badge || DEFAULT_BADGE,
    image: data.image || undefined,

    // Zachowanie notyfikacji
    tag: data.tag || "sisi-new-order",
    renotify: true,
    requireInteraction: true,
    
    // Wibracje (pattern: vibrate, pause, vibrate, pause, vibrate)
    vibrate: [200, 100, 200, 100, 200],
    
    // Dzwiek - silent: false = uzywaj domyslnego dzwieku systemu
    silent: false,
    
    // Timestamp
    timestamp: Date.now(),

    data: { 
      url, 
      orderId: data.orderId,
      ...(data.data && typeof data.data === "object" ? data.data : {}) 
    },

    actions: Array.isArray(data.actions)
      ? data.actions
      : [
          { action: "open", title: "Otworz" },
          { action: "dismiss", title: "Zamknij" }
        ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const action = event.action;
  
  // Jesli kliknieto "Zamknij" - nic wiecej nie robimy
  if (action === "dismiss") {
    return;
  }

  const url = event.notification?.data?.url || "/admin/pickup-order";
  const target = new URL(url, self.location.origin);

  event.waitUntil((async () => {
    const wins = await clients.matchAll({ type: "window", includeUncontrolled: true });

    // 1) jesli jest otwarta karta z tej samej origin -> fokus + nawigacja
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

    // 2) inaczej otworz nowe okno
    await clients.openWindow(target.href);
  })());
});

// Obsluga zamkniecia powiadomienia (swipe away)
self.addEventListener("notificationclose", (event) => {
  // Mozna tutaj logowac statystyki
  console.log("[SW] Notification closed:", event.notification.tag);
});
