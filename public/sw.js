const STATIC_CACHE = "pelada-static-v2";
const DATA_CACHE = "pelada-data-v2";
const OFFLINE_URL = "/offline";
const PROTECTED_PATHS = ["/partidas-passadas", "/votacao", "/meu-perfil"];

const PRECACHE_URLS = [
  "/",
  "/estatisticas",
  "/confirmacao-rapida",
  "/entrar",
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/apple-icon",
  "/pwa/icon-192",
  "/pwa/icon-512",
  "/favicon.ico",
];

function isSameOrigin(requestUrl) {
  return requestUrl.origin === self.location.origin;
}

function isNavigationRequest(request) {
  return request.mode === "navigate" || request.destination === "document";
}

function isPublicApiRequest(url) {
  return url.pathname.startsWith("/api/") && !url.pathname.startsWith("/api/admin") && !url.pathname.startsWith("/api/auth");
}

function shouldBypass(request, url) {
  if (request.method !== "GET") {
    return true;
  }

  if (!isSameOrigin(url)) {
    return true;
  }

  return (
    url.pathname.startsWith("/admin") ||
    url.pathname.startsWith("/api/admin") ||
    url.pathname.startsWith("/api/auth") ||
    PROTECTED_PATHS.some((path) => url.pathname === path || url.pathname.startsWith(`${path}/`))
  );
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  const response = await fetch(request);

  if (response && response.ok) {
    cache.put(request, response.clone()).catch(() => undefined);
  }

  return response;
}

async function networkFirst(request, fallbackToOffline) {
  const cache = await caches.open(DATA_CACHE);

  try {
    const response = await fetch(request);

    if (response && response.ok) {
      cache.put(request, response.clone()).catch(() => undefined);
    }

    return response;
  } catch (error) {
    const cached = await cache.match(request);

    if (cached) {
      return cached;
    }

    if (fallbackToOffline) {
      const offlineResponse = await caches.match(OFFLINE_URL);
      if (offlineResponse) {
        return offlineResponse;
      }
    }

    throw error;
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== DATA_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (shouldBypass(request, url)) {
    return;
  }

  if (
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "worker" ||
    request.destination === "font" ||
    request.destination === "image" ||
    url.pathname.startsWith("/_next/static/")
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (isNavigationRequest(request)) {
    event.respondWith(networkFirst(request, true));
    return;
  }

  if (isPublicApiRequest(url)) {
    event.respondWith(networkFirst(request, false));
    return;
  }

  event.respondWith(networkFirst(request, false));
});
