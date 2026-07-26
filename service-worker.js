"use strict";

const CACHE_NAME = "servoforge-labeler-staging-v0.8.7";
const CACHE_PREFIX = "servoforge-labeler-staging-";
const APP_SHELL_PATH = new URL("./index.html", self.location.href).pathname;
const UPDATE_MANIFEST_PATH = new URL("./update-manifest.json", self.location.href).pathname;
const SERVICE_WORKER_PATH = new URL("./service-worker.js", self.location.href).pathname;

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

function isReleaseControlRequest(requestUrl, request) {
  return request.mode === "navigate"
    || requestUrl.pathname === APP_SHELL_PATH
    || requestUrl.pathname === UPDATE_MANIFEST_PATH
    || requestUrl.pathname === SERVICE_WORKER_PATH;
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (isReleaseControlRequest(requestUrl, event.request)) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" })
        .then((response) => {
          if (response.ok && event.request.mode === "navigate") {
            caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", response.clone()));
          }
          return response;
        })
        .catch(async () => {
          if (event.request.mode !== "navigate") throw new Error(`Release resource unavailable: ${event.request.url}`);
          const cachedShell = await caches.match("./index.html");
          if (cachedShell) return cachedShell;
          throw new Error(`Application shell unavailable: ${event.request.url}`);
        })
    );
    return;
  }

  event.respondWith(
    fetch(event.request, { cache: "no-store" })
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        throw new Error(`Offline resource unavailable: ${event.request.url}`);
      })
  );
});
