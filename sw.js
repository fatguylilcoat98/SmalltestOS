// Minimal service worker: makes the app installable and caches the tiny app
// shell (HTML/CSS/JS/icon) so it opens offline. It deliberately does NOT touch
// model weights — WebLLM caches those itself in the Cache API / IndexedDB.
const SHELL = "smalltestos-shell-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // Cache-first only for our own same-origin GET requests (the app shell).
  // Everything else (WebLLM CDN, model weights) goes straight to network.
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  event.respondWith(caches.match(event.request).then((r) => r || fetch(event.request)));
});
