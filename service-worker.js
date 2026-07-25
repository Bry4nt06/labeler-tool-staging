"use strict";

const CACHE_NAME = "servoforge-labeler-staging-v0.8.0";
const APP_FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./fault-config.json",
  "./manifest.webmanifest",
  "./update-manifest.json",
  "./config/company-default-settings.json",
  "./assets/labeler-tool-icon.svg",
  "./drivers/geometry/label-geometry-driver.js",
  "./drivers/application/application-mode-driver.js",
  "./drivers/mechanical/mechanical-motion-driver.js",
  "./drivers/mechanical/cold-glue-motion-driver.js",
  "./drivers/servo/servo-command-driver.js",
  "./drivers/planning/motion-planner-driver.js",
  "./drivers/planning/mechanical-event-planner-driver.js",
  "./drivers/translation/profile-translator-driver.js",
  "./drivers/validation/motion-validation-driver.js",
  "./drivers/validation/servo-pipeline-validator-driver.js",
  "./drivers/profile/apl-profile-driver.js",
  "./app/defaults.js",
  "./app/persistence.js",
  "./app/zone-site-configuration.js",
  "./app/geometry-and-planning.js",
  "./app/profile-generation.js",
  "./app/simulation-engine.js",
  "./app/assemblies.js",
  "./app/wipe-down-builder.js",
  "./app/validation.js",
  "./app/setup-bindings.js",
  "./app/map-rendering.js",
  "./app/table-rendering.js",
  "./app/bootstrap.js",
  "./app/motion-planner-ui.js",
  "./app/profile-translator-integration.js",
  "./app/servo-pipeline-validator-integration.js",
  "./app/simulator-milestone.js",
  "./app/milestone-6-7-integration.js",
  "./app/update-service-fix.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_FILES)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("./index.html")))
  );
});
