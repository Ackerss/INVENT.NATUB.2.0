// Incremente a versão do cache sempre que arquivos importantes (app.js, index.html) forem alterados.
const CACHE_NAME = 'inventario-granel-cache-v12'; // NOVA VERSÃO DO CACHE
const urlsToCache = [
  './',
  './index.html', // Atualizado
  './app.js',     // Atualizado
  './manifest.json',
  './potes.json',
  // CDNs
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
];

self.addEventListener('install', event => {
  console.log('[Service Worker] Instalando v12...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Fazendo cache dos arquivos da aplicação v12');
        const networkRequests = urlsToCache.map(url => fetch(url, { cache: 'reload' }));
        return Promise.all(networkRequests)
          .then(responses => {
            const cachePromises = responses.map((response, index) => {
              if (!response.ok) {
                console.warn(`[Service Worker] Falha ao buscar ${urlsToCache[index]} da rede durante install. Status: ${response.status}`);
                return caches.match(urlsToCache[index]).then(cached => cached || null);
              }
              const responseToCache = response.clone();
              console.log(`[Service Worker] Cacheando da rede: ${urlsToCache[index]}`)
              return cache.put(urlsToCache[index], responseToCache);
            });
            return Promise.all(cachePromises);
          });
      })
      .then(() => {
        self.skipWaiting();
        console.log('[Service Worker] Instalação completa v12, skipWaiting chamado.');
      })
      .catch(error => {
        console.error('[Service Worker] Falha na instalação do cache v12:', error);
      })
  );
});

self.addEventListener('activate', event => {
  console.log('[Service Worker] Ativando v12...');
  event.waitUntil(
    caches.keys().then(keyList => {
      return Promise.all(keyList.map(key => {
        if (key !== CACHE_NAME) {
          console.log('[Service Worker] Removendo cache antigo:', key);
          return caches.delete(key);
        }
      }));
    }).then(() => {
      console.log('[Service Worker] Cache limpo, ativado e pronto para controlar clientes v12.');
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method === 'POST') {
    event.respondWith(fetch(event.request).catch(error => {
        console.error('[Service Worker] Erro no fetch POST:', error);
        return new Response(JSON.stringify({ result: 'error', message: 'Falha na conexão de rede.' }), {
          headers: { 'Content-Type': 'application/json' }
        });
    }));
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        const fetchPromise = fetch(event.request).then(networkResponse => {
            if (networkResponse.ok) {
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, networkResponse.clone());
                });
            }
            return networkResponse;
        }).catch(error => {
            console.error('[Service Worker] Erro ao buscar na rede (Stale-While-Revalidate):', event.request.url, error);
            if (!cachedResponse) throw error;
        });
        return cachedResponse || fetchPromise;
      })
  );
});
