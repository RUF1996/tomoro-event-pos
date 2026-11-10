
'use strict';

// Ganti versi ini setiap kali ada pembaruan aplikasi.
const CACHE_NAME = 'tomoro-event-pos-v3';

// Sesuaikan dengan lokasi GitHub Pages.
const APP_BASE = '/tomoro-event-pos/';

const APP_FILES = [
  APP_BASE,
  APP_BASE + 'index.html'
];

// INSTALL: simpan file utama agar aplikasi bisa dibuka offline.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});

// ACTIVATE: hapus cache aplikasi versi lama.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name =>
              name.startsWith('tomoro-event-pos-') &&
              name !== CACHE_NAME
            )
            .map(name => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// FETCH: atur strategi jaringan dan cache.
self.addEventListener('fetch', event => {
  const request = event.request;

  // Hanya tangani request GET.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Jangan cache koneksi ke Google Apps Script.
  if (
    url.hostname.includes('script.google.com') ||
    url.hostname.includes('googleusercontent.com')
  ) {
    return;
  }

  // Hanya tangani file dari aplikasi ini.
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(APP_BASE)) return;

  // HALAMAN HTML: network first, cache sebagai cadangan.
  if (
    request.mode === 'navigate' ||
    url.pathname.endsWith('.html') ||
    url.pathname === APP_BASE
  ) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => cache.put(request, copy));

          }

          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);

          if (cached) return cached;

          return caches.match(APP_BASE + 'index.html');
        })
    );

    return;
  }

  // FILE LAIN: cache first, jaringan sebagai cadangan.
  event.respondWith(
    caches.match(request)
      .then(cached => {
        const networkRequest = fetch(request)
          .then(response => {
            if (response && response.ok) {
              const copy = response.clone();

              caches.open(CACHE_NAME)
                .then(cache => cache.put(request, copy));
            }

            return response;
          });

        return cached || networkRequest;
      })
      .catch(() => {
        return caches.match(request);
      })
  );
});
