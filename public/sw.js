// Bubble Arena 서비스 워커
// 목적: 브라우저가 "앱 설치"를 허용하는 조건(fetch 처리기)을 채우는 것.
// 캐시는 하지 않음 → 새로 배포하면 바로 최신 버전이 열린다 (오프라인 플레이는 지원하지 않음).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  const req = event.request;
  // 같은 사이트의 GET 요청만 그대로 네트워크로 전달. 그 외(다른 사이트, POST 등)는 브라우저 기본 처리
  // (게임 서버 WebSocket 은 서비스 워커를 거치지 않음)
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(fetch(req));
});
