# public/assets

- **models/** — 캐릭터 GLB 모델 (mongle, piko, mossi, buru). `src/characters/ModelLibrary.js` 가 로드·정규화하고,
  아이템/블록/장애물은 `src/systems/views/ItemModels.js`, `src/map/ThemeKit.js` 에서 코드로 생성합니다.
- **textures/** — 잔디·돌·나무 등 텍스처는 Canvas 로 생성합니다.
- **sounds/** — 효과음·배경음은 `src/core/AudioManager.js` 에서 Web Audio API 로 합성합니다.
