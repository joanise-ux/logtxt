/* ═══════════════════════════════════════════════════════════════
   log.txt — service worker
   strategia: network-first z zapasem z cache (działa offline)
   ═══════════════════════════════════════════════════════════════ */

const CACHE = "logtxt-v6";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./i18n.js",
  "./db.js",
  "./config.js",
  "./vendor/supabase-js-2.58.0.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  // zapytania do obcych hostów (np. API transkrypcji) idą prosto do sieci —
  // inaczej offline'owy fallback oddałby im index.html zamiast błędu
  if (new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // odśwież kopię w cache (tylko pliki z własnej domeny)
        if (res.ok && new URL(e.request.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(e.request, { ignoreSearch: true }).then(
          (hit) => hit || caches.match("./index.html")
        )
      )
  );
});
