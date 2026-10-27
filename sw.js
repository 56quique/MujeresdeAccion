const CACHE_NAME = 'app-v1';
const ASSETS = [
  './',
  './index.html',
  './devocional.html',
  './articulos.html',
  './articulo.html',
  './editoras.html',
  './estilos.css',
  './js/config.js',
  './js/utils.js',
  './js/home.js',
  './js/devocional.js',
  './js/articulos.js',
  './js/editor.js',
  './js/github.js',
  './data/site.json',
  './data/menu.json',
  './data/devocionales.json',
  './data/articulos.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});