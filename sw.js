/* 鲸鱼娘 · 深海米饭 Roguelite — Service Worker
   作用：把整个游戏缓存到本地，之后断网也能玩喵。 */

var CACHE_NAME = 'whale-rice-v1';

var ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-1024.png',
  './icons/favicon-32.png'
];

/* 安装：预缓存所有资源 */
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      // 单个资源失败不影响整体安装
      return Promise.all(
        ASSETS.map(function (url) {
          return cache.add(url).catch(function () { /* 忽略单个失败 */ });
        })
      );
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

/* 激活：清理旧版本缓存 */
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; })
            .map(function (k) { return caches.delete(k); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

/* 请求：缓存优先，网络兜底 */
self.addEventListener('fetch', function (event) {
  var req = event.request;

  // 只处理 GET
  if (req.method !== 'GET') return;

  // 只处理同源请求
  var url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) {
        // 命中缓存：后台静默更新（stale-while-revalidate）
        fetch(req).then(function (res) {
          if (res && res.status === 200) {
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(req, res.clone());
            });
          }
        }).catch(function () {});
        return cached;
      }

      // 未命中：走网络，成功后写入缓存
      return fetch(req).then(function (res) {
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(req, copy);
        });
        return res;
      }).catch(function () {
        // 网络也失败：如果是导航请求，回退到首页
        if (req.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return new Response('离线且未缓存喵', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      });
    })
  );
});
