# Bubble Arena 3D — 작업 규칙 및 인수인계

## 반드시 지킬 규칙
- **배포는 사용자 승인 시에만.** `main` 에 Push 하면 GitHub Actions 가 GitHub Pages 로 자동 배포된다.
  작업 후에는 테스트·빌드까지만 하고, "배포할까요?" 라고 묻고 명확한 승인이 있을 때만 커밋·Push 한다.
- 사용자와는 **한국어**로 대화한다 (안내 상자 포함).
- 기존 기능/파일을 임의로 삭제하거나 덮어쓰지 않는다.

## 저장소 / 배포
- GitHub: https://github.com/jangwonbok/Bubble_Arena (브랜치 `main`)
- 플레이 주소: https://jangwonbok.github.io/Bubble_Arena/
- 워크플로: `.github/workflows/deploy.yml` (npm ci → test:sim, test:mech → build → Pages)
- 온라인 대전은 별도 Node 서버 필요 (`npm run server`, Pages 에서는 `?server=wss://.../ws` 또는 저장소 변수 `GAME_SERVER_URL`)

## 실행 / 검증
- `npm run dev` (Vite), `npm run server` (게임 서버), `npm run build`
- 테스트: `npm run test:sim`, `npm run test:mech`, `npm run test:net` (서버 실행 중일 때), `node tests/print-maps.mjs`
- Windows: 8724–8823 등 예약 포트 주의 (기본 게임 서버 포트 2567)
- 개발 모드에서 `window.__game` 으로 상태 확인 가능

## 현재 상태 (2026-11-27)
- 게임: 싱글 / AI 연습전 / 온라인 일반전 / 친구 초대전, 17×17 맵 6종, 밀 수 있는 블록, 아이템 9종, GLB 캐릭터 4종(몽글·피코·모씨·부루)
- 최근 작업: 아이템 9종 디자인을 참고 아이콘 시트 기반으로 재제작 (`src/systems/views/ItemModels.js`),
  아이템 아래 색 받침 제거 → 그림자만 (`src/systems/views/ItemView.js`), UI 아이콘 자동 프레이밍.
  테스트·빌드 통과. → 2026-11-27 아래 변경들과 함께 커밋 `225ef83` 로 배포 완료.
- UI 2.0 (참고 이미지 기반 전면 개편, 미커밋): 메인(프로필 카드·원형 아이콘·모드 카드 도크), 싱글/연습 선택(3D 맵 썸네일),
  대기방(전신 캐릭터 카드·받침대), 인게임 HUD(점수/생존·타이머·컬러 참가자 카드·하단 능력치 바·조작법).
  공용 모달/상단 버튼 `src/ui/Modals.js`, 아이콘 `src/ui/icons.js`, 스타일 `src/styles/ui*.css`(main.css 위에 덮어씀).
  맵 썸네일은 `Game.buildMapThumbs()`, 전신 이미지는 `renderFigure()`(ModelLibrary).
- 로컬 미리보기: Windows 예약 포트 때문에 Vite 를 4173 으로 실행 (`.claude/launch.json`)
- (미커밋) 폭발 연출 개선(방향별 이어진 물줄기), 물줄기 칸 진입 차단(`CollisionSystem.isFlameBlocked`, `FLAME_SAFE_TAIL`),
  신규 맵 2종 `pirate`(해적섬: 3칸 바다 해협 + 다리 3개 + 큰 파도) · `castle`(스위트 캐슬: 중앙 분수대 + 사탕 가속 고리) → 총 8종,
  싱글 AI 인원 1~3명 선택(`startLocal({ aiCount })`, 프로필에 저장). 맵 정의의 `visual.floorAt/wallAt/pillarAt/blockAt/landmarks` 로 칸별 외형 지정 가능
- (미커밋) 모바일 지원: `src/core/Device.js`(터치 기기 자동 감지, `?touch=1/0` 강제), `src/ui/TouchControls.js`(플로팅 조이스틱 + 물풍선/원격 버튼, 멀티터치),
  `Input.setTouchDir/queueBomb` (키보드 우선), `src/styles/mobile.css`(세로/가로 휴대폰·태블릿), SceneManager 세로 화면 카메라(fov 56·안개 보정)·저사양 렌더링.
  실기기 테스트는 아직 안 함 (브라우저 모바일 에뮬레이션으로만 확인)
- 위 "(미커밋)" 항목들은 모두 2026-11-27 커밋 `225ef83` 로 GitHub Pages 배포 완료
- 이후 배포: 배경음 엔진(메뉴/경기/남은 30초, 맵별 조·음색, 배경음·효과음 볼륨 분리), 휴대폰 확대·추적 카메라(`SceneManager.computeZoom`, HUD 확대 버튼),
  아이템 획득 알림을 상단 작은 칩으로 (`HUD.itemNotice`, ×N 합치기·최대 2개)
- 이후 배포: 모바일 전체 화면(`src/core/Fullscreen.js`, iPhone 은 홈 화면 추가 안내 + `public/manifest.webmanifest`·`public/icons/`),
  세로 화면 위아래 추적 카메라(`solveLookZ` 로 맵이 상단 HUD~조작 버튼 사이에 오도록), 가로 화면 좌우 데드존, 세로 터치 HUD 한 줄 배치

## 구조 요약
- 공용 로직(서버와 공유, Three.js 없음): `src/core/MatchSimulation.js`, `src/systems/*`, `src/map/MapGrid.js`, `src/maps/*`, `src/characters/Character.js`, `src/net/protocol.js`
- 렌더링: `src/map/MapView.js`, `src/map/ThemeKit.js`, `src/characters/CharacterModel.js`, `src/characters/ModelLibrary.js`, `src/systems/views/*`
- 서버: `server/` (Room = 방별 독립 시뮬레이션, 서버 권한 판정)
- 자세한 내용은 README.md
