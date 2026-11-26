import { defineConfig } from 'vite';

export default defineConfig({
  // 상대 경로 빌드: GitHub Pages(https://<user>.github.io/<repo>/) 하위 경로,
  // 게임 서버의 dist 정적 제공, 로컬 미리보기 어디서든 같은 빌드가 동작
  base: './',
  server: {
    port: 5173,
    // Windows에서 파일 잠금(EBUSY)으로 감시자가 종료되는 문제 방지
    watch: { usePolling: true, interval: 300 },
  },
  build: {
    chunkSizeWarningLimit: 1000,
  },
});
