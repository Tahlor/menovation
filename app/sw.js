/**
 * Menovation Offline Service Worker
 * Implements Cache-First caching for app shell & static assets,
 * and Network-First for API requests with offline cache fallback.
 */

const CACHE_NAME = 'menovation-offline-v6';

const STATIC_PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/db.js',
  './js/app.js',
  './js/tv.js',
  './assets/images/menovation-wordmark-sand.png',
  './assets/images/menovation-sq-purple-512.png',
  './assets/images/menovation-sq-purple-300.png',
  './assets/fonts/prata-latin-400-normal.woff2',
  './assets/fonts/NunitoSans-Regular.woff2',
  './assets/fonts/NunitoSans-SemiBold.woff2',
  './assets/fonts/NunitoSans-Bold.woff2'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching offline app shell');
      return cache.addAll(STATIC_PRECACHE_URLS).catch((err) => {
        console.warn('[Service Worker] Some precache assets failed to load:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Evicting outdated cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Bypass Service Worker completely for media streaming (videos, audio, Range requests, GIFs)
  if (
    event.request.headers.has('range') ||
    event.request.destination === 'video' ||
    event.request.destination === 'audio' ||
    requestUrl.pathname.includes('/videos/') ||
    requestUrl.pathname.includes('/gifs/')
  ) {
    return;
  }

  // Cache-First for static assets (fonts, images, CSS, scripts, pre-bundled JSON)
  if (
    event.request.destination === 'font' ||
    event.request.destination === 'image' ||
    event.request.destination === 'style' ||
    event.request.destination === 'script' ||
    requestUrl.pathname.includes('/assets/')
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // Network-First with Cache Fallback for navigation and HTML documents
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return new Response('Offline: Resource unavailable', {
          status: 503,
          statusText: 'Service Unavailable (Offline)'
        });
      });
    })
  );
});
