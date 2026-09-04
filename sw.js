/* ═══════════════════════════════════════════════════════════════
   log.txt — service worker

   • powłoka apki (HTML/CSS/JS/ikony) trzymana w cache i odświeżana
     w tle — stale-while-revalidate
   • nawigacje: network-first, w zapasie cache, na końcu offline.html
   • Supabase i inne obce hosty nigdy nie przechodzą przez cache —
     stare dane albo zapisana sesja to gorsze zło niż brak offline'u

   PRZY KAŻDYM DEPLOYU podbij VERSION, inaczej użytkownicy zostaną
   na starych plikach do czasu zamknięcia wszystkich okien apki.
   ═══════════════════════════════════════════════════════════════ */

const VERSION = "logtxt-v9";
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;

// tylko pewne, statyczne ścieżki — jeden 404 wywala całą instalację
const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./offline.html",
  "./styles.css",
  "./app.js",
  "./i18n.js",
  "./db.js",
  "./config.js",
  "./vendor/supabase-js-2.58.0.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(SHELL)
      .then((c) => c.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// pozwala stronie wymusić przejęcie przez nową wersję bez czekania
self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;

  // POST/PATCH i spółka nigdy nie przechodzą przez cache
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Supabase (auth, dane, storage) i inne obce hosty — prosto do sieci.
  // Inaczej offline'owy fallback oddałby im HTML zamiast błędu, a zapisana
  // odpowiedź auth potrafi zepsuć sesję.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  // nawigacje: sieć → cache → offline.html
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(RUNTIME).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() =>
          caches.match(req, { ignoreSearch: true })
            .then((hit) => hit || caches.match("./index.html"))
            .then((hit) => hit || caches.match("./offline.html"))
        )
    );
    return;
  }

  // statyki: oddaj z cache od razu, odśwież w tle
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(RUNTIME).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);

      return cached || network;
    })
  );
});
