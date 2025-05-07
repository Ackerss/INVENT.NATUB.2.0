// Incremente a versão do cache sempre que arquivos importantes (app.js, index.html, potes.json) forem alterados.
const CACHE_NAME = 'inventario-granel-cache-v10'; // NOVA VERSÃO DO CACHE
const urlsToCache = [
  './',
  './index.html', // Atualizado
  './app.js',     // Mantido (sem mudanças funcionais nesta etapa)
  './manifest.json',
  './potes.json',
  // CDNs
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
];

self.addEventListener('install', event => {
  console.log('[Service Worker] Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Fazendo cache dos arquivos da aplicação');
        // Força a rede para buscar versões novas durante a instalação
        const networkRequests = urlsToCache.map(url => fetch(url, { cache: 'reload' }));
        return Promise.all(networkRequests)
          .then(responses => {
            const cachePromises = responses.map((response, index) => {
              if (!response.ok) {
                // Se falhar ao buscar da rede, tenta pegar do cache antigo (se existir) ou ignora
                console.warn(`[Service Worker] Falha ao buscar ${urlsToCache[index]} da rede durante install. Status: ${response.status}`);
                return caches.match(urlsToCache[index]).then(cached => cached || null); // Retorna null se não achar no cache antigo
              }
              return cache.put(urlsToCache[index], response);
            });
            return Promise.all(cachePromises);
          });
      })
      .then(() => {
        self.skipWaiting();
        console.log('[Service Worker] Instalação completa, skipWaiting chamado.');
      })
      .catch(error => {
        console.error('[Service Worker] Falha na instalação do cache:', error);
      })
  );
});

self.addEventListener('activate', event => {
  console.log('[Service Worker] Ativando...');
  event.waitUntil(
    caches.keys().then(keyList => {
      return Promise.all(keyList.map(key => {
        if (key !== CACHE_NAME) {
          console.log('[Service Worker] Removendo cache antigo:', key);
          return caches.delete(key);
        }
      }));
    }).then(() => {
      console.log('[Service Worker] Cache limpo, ativado e pronto para controlar clientes.');
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

  // Estratégia: Stale-While-Revalidate para assets principais
  // Serve do cache primeiro (rápido), mas busca atualização na rede em paralelo.
  if (urlsToCache.includes(event.request.url) || event.request.url === self.location.origin + '/') {
      event.respondWith(
          caches.open(CACHE_NAME).then(cache => {
              return cache.match(event.request).then(cachedResponse => {
                  const fetchPromise = fetch(event.request).then(networkResponse => {
                      // Verifica se a resposta da rede é válida antes de atualizar o cache
                      if (networkResponse.ok) {
                          cache.put(event.request, networkResponse.clone());
                      }
                      return networkResponse;
                  }).catch(error => {
                      console.error('[Service Worker] Erro ao buscar na rede (Stale-While-Revalidate):', event.request.url, error);
                      // Se a rede falhar e tivermos algo no cache, ainda servimos o cache
                      if (cachedResponse) return cachedResponse;
                      // Senão, o erro será propagado
                  });

                  // Retorna a resposta do cache imediatamente se existir,
                  // enquanto a busca na rede acontece em segundo plano.
                  return cachedResponse || fetchPromise;
              });
          })
      );
  } else {
      // Para outros recursos não explicitamente cacheados, usa Network Only
      event.respondWith(fetch(event.request).catch(error => {
           console.warn('[Service Worker] Erro ao buscar recurso não cacheado:', event.request.url, error);
           // Pode retornar uma resposta genérica de erro ou offline se necessário
      }));
  }
});
