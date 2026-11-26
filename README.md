# Bubble Arena 3D

Three.js로 만든 3D 물풍선 아케이드 대전 게임.
싱글 플레이 · AI 연습전 · 온라인 일반전 · 친구 초대전 / 6개 테마 맵 (17×17) / 밀 수 있는 블록.

```bash
npm install
```

---

## 바로 플레이 (GitHub Pages)

**https://jangwonbok.github.io/Bubble_Arena/** — 설치 없이 브라우저에서 싱글 플레이 · AI 연습전 플레이 가능

- `main` 브랜치에 Push 하면 GitHub Actions(`.github/workflows/deploy.yml`)가 테스트 → 빌드 → Pages 배포를 자동 수행
- 빌드는 상대 경로(`base: './'`)라 저장소 하위 경로에서도 GLB 모델 · 리소스가 정상 로드됨
- **온라인 일반전 / 친구 초대전은 Node 게임 서버가 별도로 필요** (GitHub Pages 는 정적 파일만 제공).
  서버를 HTTPS(wss) 로 배포한 뒤 둘 중 하나로 연결:
  - 접속 주소에 `?server=wss://서버주소/ws` 추가 (예: `https://jangwonbok.github.io/Bubble_Arena/?server=wss://example.com/ws`)
  - 또는 저장소 Settings → Secrets and variables → Actions → Variables 에 `GAME_SERVER_URL` = `wss://서버주소/ws` 를 등록하고 재배포
  - Pages 는 HTTPS 이므로 서버도 반드시 `wss://` (TLS) 여야 브라우저가 접속을 허용함

## 1. 게임 서버 실행 (온라인 모드용)

```bash
npm run server            # ws://localhost:2567/ws  (Node.js + ws)
PORT=3000 npm run server  # 포트 변경 (Windows PowerShell: $env:PORT=3000; npm run server)
```

- `http://localhost:2567/health` → 서버 상태(방 수, 진행 중 경기 수)
- `npm run build` 후 서버를 켜면 `http://<서버IP>:2567/` 에서 **클라이언트까지 함께 제공**합니다 (같은 네트워크의 다른 PC에서 바로 접속 가능).
- Windows에서 `EACCES`가 나면 해당 포트가 OS 예약 범위입니다 → `netsh int ipv4 show excludedportrange protocol=tcp` 로 확인 후 다른 포트 사용.

## 2. 클라이언트 실행

```bash
npm run dev                # http://localhost:5173  (개발 서버)
npm run dev -- --host      # 같은 네트워크의 다른 기기에서도 접속 가능
npm run build              # dist/ 배포용 빌드
```

클라이언트가 접속할 게임 서버 주소 (우선순위):
1. URL 파라미터 `?server=ws://호스트:포트/ws`
2. 환경 변수 `VITE_SERVER_URL`
3. 개발 모드: `ws://<페이지 호스트>:2567/ws`
4. 배포 모드: 페이지와 같은 주소의 `/ws`

싱글 플레이 / AI 연습전은 서버 없이 동작합니다.

## 3. 여러 브라우저에서 멀티플레이 테스트

1. 터미널 1: `npm run server` / 터미널 2: `npm run dev`
2. 브라우저 A: `http://localhost:5173` → **친구 초대전 → 방 만들기** → `초대 링크 복사`
3. 브라우저 B(다른 브라우저, 시크릿 창, 또는 같은 브라우저의 새 탭): 초대 링크 열기 → `코드로 입장`
   - 세션은 탭 단위(sessionStorage)라 같은 브라우저의 두 탭도 서로 다른 플레이어로 접속됩니다.
4. 맵 투표 · 준비 완료 → 방장이 **게임 시작**
5. **온라인 일반전**은 `빠른 매칭 시작`만 누르면 대기 중인 공개 방에 자동으로 들어갑니다.
6. 다른 PC: 서버 PC의 IP로 `npm run dev -- --host` 페이지 접속 (예: `http://192.168.0.10:5173`)

자동 테스트:
```bash
npm run test:sim                              # 6개 맵 × 3판 헤드리스 시뮬레이션 (대칭/연결성/예외 검사)
node tests/print-maps.mjs [mapId]              # 맵 레이아웃 ASCII 출력 + 블록 밀도/도달 불가 칸 검사
node tests/mechanics-test.mjs                 # 블록 밀기 · 용암 · 이동형 발판/낙하 · 기본 범위 · 맵 크기
npm run server  &  npm run test:net           # 서버 통합 테스트 (WebSocket 클라이언트 2개)
node tests/net-test.mjs ws://localhost:3000/ws  # 다른 포트
```

---

## 조작

| 키 | 동작 |
|---|---|
| WASD / 방향키 | 이동 |
| SPACE | 물풍선 설치 |
| E / Shift | 원격 폭발 (원격 폭발 아이템 보유 시) |
| ESC / P | 일시정지 (온라인은 메뉴만 열리고 경기는 계속) |

## 게임 모드

| 모드 | 구성 | 규칙 |
|---|---|---|
| 싱글 플레이 | 나 + AI 3 | 내가 탈락하면 종료, 최후의 1인 / 3분 후 최고 점수. 기록 저장 |
| AI 연습전 | 나 + AI 3 | 탈락해도 2.5초 후 부활(능력치 초기화), 3분 점수 경쟁. 기록 미저장 |
| 온라인 일반전 | 실제 플레이어 최대 4 | 빠른 매칭(공개 방). 방장이 맵 선택/랜덤 |
| 친구 초대전 | 방 코드 초대, 최대 4 | 맵 투표(최다 득표, 동률 무작위). 빈자리 AI 채우기 옵션 |

## 기본 규칙 수치

- 맵 17×17 (외곽 벽 포함), 제한 시간 3분
- 블록 밀도: 이동 가능한 칸의 약 70~85% 가 블록 (얼음 호수·하늘 협곡 주변은 의도적으로 성김). 중앙 광장과 통로(openLanes)만 비워 두어 길을 직접 뚫고, 밀 수 있는 블록으로 길목을 막거나 여는 전략 플레이
- 블록은 테마마다 2종을 2×2 군집 체크 무늬로 섞어 배치 (예: 나무 상자 + 풀숲 블록, 초콜릿 + 선물 상자)
- 물풍선: 기본 1개(최대 3) · **기본 물줄기 1칸**(아이템으로 최대 5칸) · 2.5초 후 폭발
- **밀 수 있는 블록**(맵마다 모양이 다름: 파란 화살표 상자/눈덩이/마그마 바위/나무통/젤리 큐브/구름 쿠션): 블록 쪽으로 0.25초 계속 밀면 한 칸 이동. 앞이 비어 있어야 하며(블록·물풍선·아이템·캐릭터·허공·용암 불가), 물줄기에 맞으면 파괴되고 아이템이 나올 수 있음

## 캐릭터 (GLB 모델)

| 캐릭터 | 모델 파일 | 팀 색 | 특징 |
|---|---|---|---|
| 몽글 | `public/assets/models/mongle.glb` | 보라 | 구름 모자 + 라벤더 몸. 팔·다리 애니메이션 |
| 피코 | `piko.glb` | 주황 | 떠다니는 로봇 (다리 없음 → 공중 부양 이동, 안테나 흔들림) |
| 모씨 | `mossi.glb` | 초록 | 이끼 몬스터. 발·팔 애니메이션 |
| 부루 | `buru.glb` | 분홍 | 모자 쓴 고양이. 앞발·꼬리 애니메이션 |

- 로드 시 자동 정규화: 정면 +Z, 높이 1.3칸·너비 최대 1.12칸, 발바닥 y=0, 중심 정렬 (`src/characters/ModelLibrary.js`)
- 이름 있는 파츠(`leg_*`, `foot_*`, `arm_*`, `paw_*`, `eye_*`, `tail`, `antenna`)를 찾아 걷기·팔 흔들기·눈 깜빡임·만세·꼬리 흔들기 애니메이션 적용
- 캐릭터 발밑에 팀 색 링 표시, UI 아바타는 모델을 렌더링한 초상화 이미지 사용
- GLB 로드에 실패하면 기존 절차적 모델로 자동 대체
- 모델 교체: 같은 이름으로 GLB 파일을 덮어쓰면 됨. 새 캐릭터는 `characterDefs.js` 의 `model` 값 추가

## 아이템 (9종)

블록을 부수면 맵별 확률로 등장. 등장 가중치는 기본값 + 맵 정의의 `items.weights` 로 조정.

| 아이템 | 효과 |
|---|---|
| 💧 물풍선 증가 | 동시에 설치할 수 있는 물풍선 +1 (최대 3개) |
| 🌊 물줄기 확장 | 폭발 범위 +1칸 (최대 5칸) |
| 👟 스피드 업 | 이동 속도 증가 (최대 1.5배) |
| 🛡️ 방어막 | 10초 동안 물줄기 공격 1회 방어 (방어 후 1초 무적) |
| 📡 원격 폭발 | 다음 물풍선 3개(최대 5)를 **E / Shift** 로 원하는 순간에 폭발. 안 누르면 8초 후 자동 폭발 |
| ❤️ 생명 추가 | 탈락 시 1회 생존 (물방울 → 그 자리에서 풀려남 / 용암·낙하 → 시작 위치로) |
| 🦘 점프 슈즈 | 6초 동안 블록·물풍선을 넘어 다니고 물줄기에 맞지 않음 (블록 위에서는 착지하지 않음) |
| ⏳ 시간 지연 | 주변 5칸 안의 상대를 4초 동안 절반 속도로 |
| 🧲 아이템 자석 | 10초 동안 주변 3칸의 아이템을 끌어당겨 자동 획득 |

AI도 원격 폭발을 사용합니다 (상대가 범위 안에 있고 자신은 안전할 때). 모든 효과는 서버에서 판정되어 온라인에서도 동일하게 적용됩니다.
새 아이템 추가: `src/systems/items/itemDefs.js` 에 항목 하나 + `src/systems/views/ItemView.js` 에 3D 아이콘 추가.

## 맵 (6종)

| 맵 | 구조 · 특수 효과 |
|---|---|
| 🌿 초원 마을 | 중앙 꽃밭 광장, 둥근 나무 장애물 · 기본 규칙 |
| ❄️ 얼음 왕국 | 중앙 얼음 호수(1.25배 속도, 키를 떼도 미끄러짐) · 얼음 결정 · 눈사람 · 밀 수 있는 눈덩이 |
| 🌋 화산 지대 | 보랏빛 암반 + 십자 용암 강(**닿으면 즉시 탈락**, 다리로만 건넘) · 분화구 · 9초마다 분출(2.2초 전 경고) |
| 🌊 열대 해변 | 야자수 · 해변 바위 · 나무통 · 12초마다 **밀물**이 가장자리 2줄을 덮음(좌우 ↔ 위아래 번갈아, 2.5초 전 경고) |
| 🍭 캔디 월드 | 사탕 지팡이 · 컵케이크 · 초콜릿 블록 · 중앙 젤리 바닥(0.6배) · 줄무늬 사탕길(1.55배) · 젤리 큐브 |
| ☁️ 하늘 섬 | 중앙 허공 협곡을 **왕복하는 이동형 발판**(타면 함께 이동) · 발판 없는 허공은 **낙하 탈락** · 10초마다 구름 붕괴 |

모든 맵은 17×17 격자, 4방향 대칭으로 생성되고, 시작 위치 주변 안전 공간과 시작 위치 간 연결성을 생성 시 검사합니다. 위험 지역은 AI의 위험 지도에도 반영되어 AI도 피합니다.

---

## 아키텍처

```
               ┌──────────── 공용 게임 로직 (Three.js/DOM 의존 없음) ────────────┐
               │ core/MatchSimulation · systems/* · systems/ai/* · map/MapGrid     │
               │ maps/* (맵 정의·효과) · characters/Character · net/protocol       │
               └──────────────▲──────────────────────────────▲────────────────────┘
                              │                              │
   싱글/연습전: 브라우저에서 실행                  온라인: Node 서버(server/Room.js)에서 실행
   Game → MatchSimulation.step()                  30Hz 고정 틱, 입력만 받아 판정
                              │                              │ tick(스냅샷+이벤트) / end
                              ▼                              ▼
               EventBus 이벤트 ──► 렌더링(View) · 사운드 · HUD  ◄── net/OnlineMatch 가 같은 이벤트로 재생
```

- **서버 권한 판정**: 이동 · 물풍선 설치/폭발/연쇄 · 피격 · 갇힘/구출/탈락 · 아이템 생성/획득 · 맵 위험 지역 · 타이머 · 점수 · 승패를 모두 서버가 계산. 클라이언트는 입력(`{seq, 방향, 물풍선}`)만 보냄.
- **동일 상태 전달**: 경기 시작 시 맵 전체(타일/지형)를 전송, 이후 매 틱 캐릭터 스냅샷 + 이벤트(물풍선, 폭발 타일, 블록 파괴, 아이템, 갇힘, 위험 지역…)를 모든 클라이언트에 동일하게 전송.
- **지연 대응**: 내 캐릭터는 같은 `MovementSystem`으로 즉시 예측 이동 → 서버 ack 이후 미확인 입력 재적용(reconciliation), 작은 오차는 부드럽게 흡수. 다른 캐릭터는 100ms 스냅샷 보간.
- **접속 종료/재접속**: 끊기면 해당 캐릭터를 즉시 AI가 대신 조종, 클라이언트는 토큰으로 자동 재접속(지수 백오프) → 진행 중인 경기 상태(맵/물풍선/아이템/위험 지역) 재전송 후 다시 조종. 60초 내 복귀하지 않으면 이탈 처리. 대기방에서 방장이 나가면 방장 자동 위임.
- **부정 행위 방지**: 메시지 크기(4KB)·빈도 제한, JSON/타입/범위 검증, 입력 번호 역순·중복 차단, 틱당 입력 처리 크레딧(속도 핵 불가), 위치 등 상태는 클라이언트 값을 절대 받지 않음, 닉네임 정제, 방장 권한 검사, 캐릭터 중복 금지.
- **방별 독립 상태**: 방마다 별도의 `MatchSimulation`, 이벤트 버스, 틱 루프.

## 새 맵 추가하기

1. `src/maps/defs/mymap.js` 작성 (기존 파일 복사):
   - `layout`: `openLanes`(항상 비우는 통로/광장), `sparse`/`sparseFill`(블록이 드문 구역), `pillars`, `extraPillars`/`removePillars`/`altPillars`(랜드마크 장애물)/`pits`/`pushBlocks`(좌상단 사분면 좌표 → 자동 4방향 대칭), `terrain` 패치(ICE/BOOST/JELLY/LAVA), `conveyors`, `blockFill`, `pushRatio`
   - `effects`: 위험 지역 `{ type: 'hazard', kind: 'eruption'|'tide'|'wave'|'crumble', pattern: 'scatter'|'tide'|'band', interval, warn, duration }`, 이동형 발판 `{ type: 'platform', track: [[x,z]...], speed, pause }`
   - `items`: 드롭 확률과 종류별 가중치
   - `visual`: 바닥 텍스처/색, 벽·장애물(`pillar`, `pillarAlt`)·블록(`block`, `blockAlt`, `push`)·구멍 스타일, 미리보기 색
   - `env`: 하늘 그라데이션, 안개, 조명, 노출, 배경(scenery), 환경 파티클
2. `src/maps/index.js`의 `MAPS` 배열에 추가.

게임 시스템과 서버 코드는 수정할 필요가 없습니다 (맵 선택 화면·투표·미리보기 이미지도 자동). 새로운 시각 스타일이 필요하면 `src/map/ThemeKit.js`의 사전(PILLARS, BLOCKS, SCENERY…)에 항목을 추가합니다.

## 폴더 구조

```
server/        index.js(HTTP+WebSocket) · RoomManager.js · Room.js(방별 대기방/경기)
src/
  core/        Game(모드·상태 머신), MatchSimulation(공용 판정), SceneManager, Input, AudioManager, Assets, EventBus, Config, rng
  map/         MapGrid(격자 로직·대칭 생성), MapView(맵 3D), ThemeKit(테마별 오브젝트), AmbientParticles
  maps/        index.js(레지스트리), defs/(맵 6종 설정), effects/HazardEffect.js · PlatformEffect.js
  characters/  Character, CharacterModel, characterDefs
  systems/     Movement(지형 포함), Collision, Bomb, Bubble, Item, AISystem
    ai/        DangerMap(맵 위험 지역 포함), Pathfinding(BFS), AIBrain
    views/     BombView, EffectsView, ItemView, HazardView, ParticleSystem
    PushSystem(블록 밀기), TerrainSystem(용암·낙하)
  net/         protocol(공용), NetClient(재접속), OnlineSession(대기방), OnlineMatch(예측·보간)
  ui/          UIManager, StartScreen, MapSelectScreen, LobbyScreen, HUD, PauseMenu, ResultScreen, components
  styles/      main.css
tests/         sim-test.mjs, mechanics-test.mjs, net-test.mjs
```
