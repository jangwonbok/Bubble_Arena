// 4종 캐릭터 정의 (외형은 public/assets/models/*.glb)
//  model : GLB 파일 이름 (assets/models/<model>.glb). 로드 실패 시 style 로 만든 기본 모델 사용
//  color : 팀 색 (물풍선·UI·마커). 모델의 대표 색에 맞춤
//  hover : 다리가 없는 캐릭터 (떠다니며 이동)
export const CHARACTER_DEFS = [
  {
    id: 0,
    name: '몽글',
    tag: 'P1',
    model: 'mongle',
    color: 0x8f7cf0,
    accent: 0xffffff,
    css: '#8f7cf0',
    style: 'cap',
    personality: null, // 플레이어
    label: 'YOU',
  },
  {
    id: 1,
    name: '피코',
    tag: 'CPU',
    model: 'piko',
    hover: true,
    color: 0xff9a3d,
    accent: 0x80f2d4,
    css: '#ff9a3d',
    style: 'spiky',
    personality: 'aggressive',
    label: '공격형',
  },
  {
    id: 2,
    name: '모씨',
    tag: 'CPU',
    model: 'mossi',
    color: 0x4caf3a,
    accent: 0xffffff,
    css: '#4caf3a',
    style: 'sprout',
    personality: 'balanced',
    label: '균형형',
  },
  {
    id: 3,
    name: '부루',
    tag: 'CPU',
    model: 'buru',
    color: 0xff6f91,
    accent: 0xee6654,
    css: '#ff6f91',
    style: 'cat',
    personality: 'survival',
    label: '생존형',
  },
];
