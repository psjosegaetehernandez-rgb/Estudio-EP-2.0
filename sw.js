/* Estudio EP — trabajador en segundo plano (service worker).
   Sirve para dos cosas: instalar la app en el celular y abrirla sin señal.
   Siempre intenta traer lo más nuevo de internet primero; solo si no hay conexión usa la copia guardada.
   Así nunca se queda "pegada" una versión vieja (el problema de la app antigua).
   Al publicar una versión nueva, cambia VERSION (y el ?v= de index.html). */
const VERSION = '2.4.0';
const CACHE = 'estudio-ep-' + VERSION;
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'css/app.css?v=' + VERSION,
  ...['config', 'model', 'store', 'render', 'print', 'catalog', 'material', 'importer', 'ui', 'extras', 'drive', 'workshop', 'app'].map(f => `js/${f}.js?v=${VERSION}`),
  'icons/icon-192.png', 'icons/icon-512.png', 'mi-material/lista.txt'];
// Letras e íconos de internet: no cambian, se guardan la primera vez
const STATIC_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdnjs.cloudflare.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then(c => Promise.all(CORE.map(u => c.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Google (Drive e inicio de sesión) nunca pasa por la copia guardada
  if (/(^|\.)google(apis)?\.com$/.test(url.hostname) && !STATIC_HOSTS.includes(url.hostname)) return;
  if (STATIC_HOSTS.includes(url.hostname)) {
    event.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  if (url.origin !== self.location.origin) return;
  // Lo propio de la app: primero internet (preguntando siempre si hay algo nuevo), si no hay, la copia
  event.respondWith(fetch(req, { cache: 'no-cache' }).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(async () => (await caches.match(req, { ignoreSearch: req.mode === 'navigate' }))
    || (req.mode === 'navigate' ? caches.match('index.html') : Response.error())));
});
