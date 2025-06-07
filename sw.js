const CACHE_NAME = 'luckhouse-games-v1.3.3'; // Mude a versão se atualizar os arquivos
const ASSETS_TO_CACHE = [
    './', // Cacheia a raiz (normalmente o index.html)
    './index.html',
    './style.css',
    './script.js',
    './manifest.json',
    './assets/logo.png', // Seu logo principal
    // Adicione aqui caminhos para outros assets importantes (outras imagens, fontes se locais)
    // Ex: './assets/icons/icon-192x192.png', etc.
    // Bibliotecas CDN (serão cacheadas se acessadas online e a estratégia permitir)
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&family=Orbitron:wght@400;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js'
];

// Evento de instalação: abre o cache e adiciona os assets principais
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Instalando...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Cache aberto, adicionando assets principais ao cache');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => {
                console.log('[Service Worker] Todos os assets principais foram cacheados.');
                return self.skipWaiting(); // Força o SW a ativar
            })
            .catch(error => {
                console.error('[Service Worker] Falha ao cachear assets durante a instalação:', error);
            })
    );
});

// Evento de ativação: limpa caches antigos
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Ativando...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Deletando cache antigo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('[Service Worker] Cache antigo limpo, ativado e pronto para controlar a página.');
            return self.clients.claim(); // Controla clientes não controlados imediatamente
        })
    );
});

// Evento fetch: intercepta requisições de rede
self.addEventListener('fetch', (event) => {
    // Tenta responder com o cache primeiro, depois rede (Cache First, Network Fallback)
    // Bom para assets estáticos que não mudam frequentemente.
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    // console.log('[Service Worker] Retornando do cache:', event.request.url);
                    return cachedResponse;
                }
                // console.log('[Service Worker] Buscando da rede:', event.request.url);
                return fetch(event.request).then(
                    (networkResponse) => {
                        // Se a requisição for bem-sucedida, clona e armazena no cache para uso futuro
                        if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') { // Só cacheia GET requests válidas
                            const responseToCache = networkResponse.clone();
                            caches.open(CACHE_NAME)
                                .then(cache => {
                                    // console.log('[Service Worker] Cacheando nova resposta de:', event.request.url);
                                    cache.put(event.request, responseToCache);
                                });
                        }
                        return networkResponse;
                    }
                ).catch(error => {
                    console.error('[Service Worker] Erro no fetch (rede ou cache):', event.request.url, error);
                    // Poderia retornar uma página offline padrão aqui se desejado e se estiver em cache
                    // return caches.match('./offline.html'); 
                });
            })
    );
});