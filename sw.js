// Incremente a versão do cache sempre que arquivos importantes (app.js, index.html, potes.json) forem alterados.
const CACHE_NAME = 'inventario-granel-cache-v9'; // NOVA VERSÃO DO CACHE
const urlsToCache = [
  './',
  './index.html',
  './app.js',
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
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        self.skipWaiting(); // Força o novo SW a se tornar ativo imediatamente
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
      return self.clients.claim(); // Permite que o SW ativo controle clientes imediatamente
    })
  );
});

self.addEventListener('fetch', event => {
  // Estratégia: Cache first, caindo para network.
  // Para requisições POST (como para o Google Script), sempre vai para a rede.
  if (event.request.method === 'POST') {
    // console.log('[Service Worker] Requisição POST, buscando na rede:', event.request.url);
    event.respondWith(fetch(event.request).catch(error => {
        console.error('[Service Worker] Erro no fetch POST:', error);
        // Opcional: retornar uma resposta de erro padronizada em JSON
        return new Response(JSON.stringify({ result: 'error', message: 'Falha na conexão de rede.' }), {
          headers: { 'Content-Type': 'application/json' }
        });
    }));
    return;
  }

  // Para outras requisições (GET para assets locais e CDNs)
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // console.log('[Service Worker] Retornando do cache:', event.request.url);
          return cachedResponse;
        }

        // console.log('[Service Worker] Não encontrado no cache, buscando na rede:', event.request.url);
        return fetch(event.request).then(
          networkResponse => {
            // Opcional: Adicionar a resposta da rede ao cache para futuras requisições
            // É importante clonar a resposta antes de usá-la e armazená-la.
            // let responseToCache = networkResponse.clone();
            // caches.open(CACHE_NAME)
            //   .then(cache => {
            //     cache.put(event.request, responseToCache);
            //   });
            return networkResponse;
          }
        ).catch(error => {
          console.error('[Service Worker] Erro ao buscar na rede:', event.request.url, error);
          // Você pode querer retornar uma página de fallback offline aqui se for um recurso crucial
          // Por exemplo: if (event.request.mode === 'navigate') return caches.match('./offline.html');
        });
      })
  );
});
