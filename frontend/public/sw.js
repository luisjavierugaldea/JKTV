/**
 * Service Worker para Canal Streaming PWA
 * Estrategia: Network First con fallback a cache
 */

const CACHE_VERSION = 'canal-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;

// Recursos estáticos para pre-cachear
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Instalación: Pre-cachear recursos estáticos
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activación: Limpiar caches antiguos
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name.startsWith('canal-') && name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
            .map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch: Network First con fallback a cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar requests no HTTP/HTTPS
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Ignorar APIs externas de streaming (no cachear videos)
  if (url.hostname.includes('tmdb') || 
      url.hostname.includes('pixeldrain') ||
      url.hostname.includes('mp4upload') ||
      url.hostname.includes('zilla-networks') ||
      url.hostname.includes('animeav1')) {
    return;
  }

  // Estrategia: Network First
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Solo cachear respuestas exitosas
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }

        // Clonar response para poder usarla y cachearla
        const responseToCache = response.clone();

        // Cachear en dynamic cache
        caches.open(DYNAMIC_CACHE)
          .then((cache) => {
            cache.put(request, responseToCache);
          });

        return response;
      })
      .catch(() => {
        // Si falla la red, intentar cache
        return caches.match(request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }

            // Si no hay cache, retornar página offline para navegación
            if (request.mode === 'navigate') {
              return caches.match('/index.html');
            }

            // Para otros recursos, dejar que falle
            return new Response('Offline', {
              status: 503,
              statusText: 'Service Unavailable',
            });
          });
      })
  );
});
