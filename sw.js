/* ═══════════════════════════════════════════════════════════════
   log.txt — service worker

   nawigacja  → network-first, zapas z cache, na końcu offline.html
   statyki    → stale-while-revalidate (szybki start, cicha aktualizacja)
   Supabase   → nigdy przez cache (stare dane i zepsuta sesja)

   PRZY KAŻDYM DEPLOYU podbij VERSION — bez tego użytkownicy zostaną
   na starej wersji, dopóki nie zamkną wszystkich okien apki.
   ═══════════════════════════════════════════════════════════════ */

const VERSION = "logtxt-v6";
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;

// szkielet apki — tylko pewne, statyczne ścieżki
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

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // tylko GET — POST/PATCH nigdy nie przechodzą przez cache
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // KRYTYCZNE: nie dotykamy Supabase ani żadnego API.
  // Cache'owanie auth/danych = stare wpisy i zepsuta sesja.
  if (
    url.hostname.endsWith(".supabase.co") ||
    url.hostname.endsWith(".supabase.in") ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/")
  ) {
    return;
  }

  // obce domeny (fonty z CDN, API transkrypcji) — zostawiamy przeglądarce;
  // inaczej offline'owy zapas oddałby im HTML zamiast błędu
  if (url.origin !== self.location.origin) return;

  // nawigacja: sieć → cache → szkielet apki → strona offline
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () =>
          (await caches.match(request, { ignoreSearch: true })) ||
          (await caches.match("./index.html")) ||
          caches.match("./offline.html")
        )
    );
    return;
  }

  // statyki (JS, CSS, ikony): stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(RUNTIME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || network;
    })
  );
});
