// 서버 통합 테스트: 실제 WebSocket 클라이언트 2개로 방 생성 → 입장 → 투표/준비 → 시작 → 입력/동기화
// → 부정 입력 차단 → 접속 종료(AI 대체) → 재접속 복구 → 이탈 처리 를 검증한다.
// 실행: (다른 터미널에서 npm run server) 후  node tests/net-test.mjs [ws://localhost:2567/ws]
import WebSocket from 'ws';

const URL = process.argv[2] || 'ws://localhost:2567/ws';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (cond, label) => {
  console.log(`${cond ? '  ✔' : '  ✘'} ${label}`);
  if (!cond) failures++;
};

class Bot {
  constructor(name, charId) {
    this.name = name;
    this.charId = charId;
    this.msgs = [];
    this.ticks = 0;
    this.events = [];
  }
  connect(token) {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(URL);
      this.ws.on('open', () => this.send({ type: 'hello', name: this.name, charId: this.charId, token }));
      this.ws.on('error', reject);
      this.ws.on('message', (raw) => {
        const m = JSON.parse(raw);
        if (m.type === 'welcome') {
          this.id = m.id;
          this.token = m.token;
          resolve(m);
        } else if (m.type === 'room') this.room = m;
        else if (m.type === 'start') {
          this.start = m;
          this.slot = m.yourSlot;
        } else if (m.type === 'tick') {
          this.ticks++;
          this.last = m;
          this.events.push(...m.ev);
        } else if (m.type === 'error') this.lastError = m.msg;
        else if (m.type === 'end') this.end = m;
      });
    });
  }
  send(m) {
    this.ws.send(JSON.stringify(m));
  }
  me() {
    return this.last?.c[this.slot];
  }
  async waitFor(fn, ms = 4000) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      if (fn()) return true;
      await sleep(20);
    }
    return false;
  }
}

const A = new Bot('Alice<script>', 0);
const B = new Bot('Bob', 0);
await A.connect();
await B.connect();
check(!!A.id && !!B.id, 'welcome 수신 + 토큰 발급');

console.log('대기방');
A.send({ type: 'create', mode: 'friend' });
await A.waitFor(() => A.room);
check(/^[A-Z0-9]{5}$/.test(A.room.code), `방 코드 자동 생성: ${A.room.code}`);
check(A.room.players[0].name === 'Alicescript', `닉네임 정제: ${A.room.players[0].name}`);
B.send({ type: 'join', code: A.room.code });
await A.waitFor(() => A.room.players.length === 2);
check(A.room.players.length === 2, '코드로 친구 입장');
check(A.room.players[1].charId !== 0, `캐릭터 중복 방지 (B → ${A.room.players[1].charId})`);
B.send({ type: 'profile', name: 'Bob', charId: 0 });
await B.waitFor(() => B.lastError);
check(!!B.lastError, `이미 선택된 캐릭터 거부: ${B.lastError}`);
B.send({ type: 'map', id: 'ice' }); // 방장이 아님 → 무시
A.send({ type: 'vote', id: 'volcano' });
B.send({ type: 'vote', id: 'volcano' });
await A.waitFor(() => A.room.votes.volcano === 2);
check(A.room.votes.volcano === 2 && A.room.mapChoice === 'random', '맵 투표 집계 + 비방장 맵 변경 무시');
A.lastError = null;
A.send({ type: 'start' });
await A.waitFor(() => A.lastError);
check(!!A.lastError, `준비 안 된 상태에서 시작 거부: ${A.lastError}`);
B.send({ type: 'ready', v: true });
A.send({ type: 'fill', v: true });
await A.waitFor(() => A.room.players[1].ready && A.room.fillAI);
A.send({ type: 'start' });
await A.waitFor(() => A.start && B.start);
check(A.start && B.start, '게임 시작 메시지 수신');
check(A.start.mapId === 'volcano', `투표로 맵 결정: ${A.start.mapId}`);
check(A.start.players.length === 4 && A.start.players.filter((p) => !p.human).length === 2, '빈자리 AI 2명으로 채움');
check(JSON.stringify(A.start.grid) === JSON.stringify(B.start.grid), '두 클라이언트에 동일한 맵 상태 전달');

console.log('게임 진행 (카운트다운 대기)');
await sleep(3800);
let seqA = 0;
let seqB = 0;
const inputLoop = setInterval(() => {
  A.send({ type: 'input', s: ++seqA, d: 3, b: 0 }); // 아래로
  B.send({ type: 'input', s: ++seqB, d: 0, b: seqB === 5 ? 1 : 0 });
}, 1000 / 30);
const a0 = { ...A.start.players[A.slot].spawn };
await sleep(600);
const aNow = A.me();
check(aNow && aNow[1] > a0.z, `입력으로 이동 (z ${a0.z} → ${aNow?.[1]})`);
check(A.last.ack > 0 && A.last.ack <= seqA, `입력 ack: ${A.last.ack}/${seqA}`);
check(B.events.some((e) => e.k === 'bp' && e.o === B.slot), '물풍선 설치 이벤트 동기화');
check(A.ticks > 10 && B.ticks > 10, `틱 수신 A=${A.ticks} B=${B.ticks}`);
check(JSON.stringify(A.last.c) === JSON.stringify(B.last.c) || Math.abs(A.last.t - B.last.t) < 0.1, '양쪽 상태 일치');

console.log('부정 행위 차단');
clearInterval(inputLoop);
const before = A.me();
// 속도 핵: 한 번에 입력 30개 폭주 + 비정상 값
for (let i = 0; i < 30; i++) A.send({ type: 'input', s: ++seqA, d: 1, b: 0 });
A.send({ type: 'input', s: ++seqA, d: 99, b: 7 });
A.send({ type: 'input', s: 'x', d: 1, b: 0 });
A.send({ type: 'teleport', x: 5, z: 5 });
await sleep(1000);
const after = A.me();
const moved = Math.abs(after[0] - before[0]) + Math.abs(after[1] - before[1]);
check(moved <= 3.2 * 1.6 * 0.35 + 0.6, `입력 폭주에도 최대 속도 이상 이동 불가 (이동량 ${moved.toFixed(2)})`);

console.log('접속 종료 → AI 대체 → 재접속');
const tokenA = A.token;
A.ws.close();
await B.waitFor(() => B.events.some((e) => e.k === 'dc'));
check(B.events.some((e) => e.k === 'dc' && e.c === A.slot), '접속 종료 알림');
await sleep(300);
check(B.last.c[A.slot][14] === 1, '끊긴 플레이어를 AI가 대체 중');
const A2 = new Bot('Alice', 0);
const w = await A2.connect(tokenA);
check(w.resumed && w.id === A.id, '토큰으로 세션 복구');
await A2.waitFor(() => A2.start);
check(A2.start?.rejoin && A2.slot === A.slot, '진행 중인 게임 상태 재전송 (rejoin)');
await A2.waitFor(() => A2.ticks > 3);
check(A2.last && A2.last.c[A2.slot][14] === 0, '재접속 후 다시 직접 조종');

console.log('이탈 처리');
B.send({ type: 'leave' });
await A2.waitFor(() => A2.room?.players.length === 1);
check(A2.room?.players.length === 1, '나간 플레이어 목록에서 제거');
check(await A2.waitFor(() => A2.events.some((e) => e.k === 'left')), '경기 중 이탈 알림 → 그 캐릭터는 AI가 계속 진행');

const junk = new WebSocket(URL);
await new Promise((r) => junk.on('open', r));
junk.send('not json');
junk.send(JSON.stringify({ type: 'join', code: '../../etc' }));
await sleep(200);
check(junk.readyState === 1, '잘못된 데이터에도 서버 정상 동작');
junk.close();

A2.ws.close();
B.ws.close();
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
