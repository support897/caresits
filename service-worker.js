/* Caresits service worker. Caches the app so it opens fast and works offline. */
const CACHE = "nannyapp-v3";
const FILES = ["./", "index.html", "styles.css", "data.js", "logic.js", "app.js", "manifest.webmanifest", "icon.svg", "logo.svg", "fonts/Newsreader.ttf", "fonts/Atkinson-Regular.ttf", "fonts/Atkinson-Bold.ttf"];
self.addEventListener("install", function (e) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener("activate", function (e) { e.waitUntil(caches.keys().then(function (names) { return Promise.all(names.filter(function (n) { return n !== CACHE; }).map(function (n) { return caches.delete(n); })); }).then(function () { return self.clients.claim(); })); });
self.addEventListener("fetch", function (e) { e.respondWith(caches.match(e.request).then(function (hit) { return hit || fetch(e.request); })); });
