// The previous sample registered a service worker for demo notifications.
// This version removes itself so no visitor keeps a stale worker.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.registration.unregister()));
