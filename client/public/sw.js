/**
 * Service Worker for Progressive Web App
 * Handles offline-first caching and background sync
 */

const CACHE_NAME = "protocol-v1";
const RUNTIME_CACHE = "habit-tracker-runtime";
const API_CACHE = "habit-tracker-api";

// Files to cache on install
const urlsToCache = [
  "/",
  "/index.html",
  "/favicon.svg",
  "/manifest.json",
  "/og-image.png",
  "/robots.txt",
  "/sitemap.xml",
];

// Install event - cache essential files
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache).catch(() => {
        console.log("Some files failed to cache, continuing anyway");
        return Promise.resolve();
      });
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (
            cacheName !== CACHE_NAME &&
            cacheName !== RUNTIME_CACHE &&
            cacheName !== API_CACHE
          ) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - implement network-first with fallback to cache
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Don't cache non-GET requests
  if (event.request.method !== "GET") {
    return;
  }

  useEffect(() => {
  // Service worker causes reload loops in dev due to stale chunk caching
  if (process.env.NODE_ENV === "development") return;

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("Service Worker registered:", registration.scope);
      })
      .catch((error) => {
        console.error("Service Worker registration failed:", error);
      });
  }
}, []);

  // Handle API calls differently
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache successful API responses
          if (response.ok) {
            const cloneResponse = response.clone();
            caches.open(API_CACHE).then((cache) => {
              cache.put(event.request, cloneResponse);
            });
          }
          return response;
        })
        .catch(() => {
          // Fall back to cached API response
          return caches
            .match(event.request)
            .then((response) => response || createOfflineResponse());
        })
    );
    return;
  }

  // Handle HTML/JS/CSS with cache-first strategy
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }

      return fetch(event.request)
        .then((response) => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200) {
            return response;
          }

          const responseToCache = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return response;
        })
        .catch(() => {
          // Return cached version if available, otherwise offline page
          return caches
            .match(event.request)
            .then((response) => response || createOfflineResponse());
        });
    })
  );
});

// Handle background sync for pending events
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-events") {
    event.waitUntil(syncPendingEvents());
  }
});

// Sync pending events from IndexedDB to server
async function syncPendingEvents() {
  try {
    const pendingEvents = await getPendingEventsFromDB();

    for (const event of pendingEvents) {
      try {
        const response = await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(event),
        });

        if (response.ok) {
          await removePendingEventFromDB(event.id);
        }
      } catch (error) {
        console.error("Failed to sync event:", error);
        // Leave in queue for next sync attempt
      }
    }
  } catch (error) {
    console.error("Background sync failed:", error);
  }
}

// Helper to get pending events (would use IndexedDB in real implementation)
async function getPendingEventsFromDB() {
  // This would open IndexedDB and get pending events
  // For now, returns empty array as placeholder
  return [];
}

// Helper to remove synced event
async function removePendingEventFromDB(id) {
  // This would delete from IndexedDB
}

// Create offline response
function createOfflineResponse() {
  return new Response(
    `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Offline</title>
      <style>
        body { font-family: system-ui; background: #0f172a; color: #e2e8f0; margin: 0; padding: 2rem; }
        h1 { color: #ef4444; }
        p { color: #cbd5e1; }
      </style>
    </head>
    <body>
      <h1>Offline</h1>
      <p>You appear to be offline. Changes will be synced when you're back online.</p>
    </body>
    </html>
    `,
    {
      headers: { "Content-Type": "text/html" },
      status: 200,
    }
  );
}

// Message handler for communicating with clients
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

console.log("Service Worker loaded");