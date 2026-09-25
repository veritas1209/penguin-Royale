# Penguin Royale

2026-09-25 실서버 릴리스 `20260926-river-126`의 스냅샷입니다. 게임은 `dist/index.html`과 `dist/assets/index-river-126.js`를 제공합니다. 방사능 지역·강·아치형 다리·농장 개선과 전설 검 액티브 스킬의 최신 판정과 효과가 포함되어 있습니다.

## 구성

- `server/`, `shared/`: 서버 판정과 공통 게임 데이터
- `src/`, `public/`: 원본 클라이언트 소스와 정적 자산
- `dist/`: **실서버에서 제공하는 빌드 결과**. 최신 패치 일부는 이 번들에 직접 반영되어 있어 `npm run build`로 재생성한 결과와 같지 않을 수 있습니다.
- `training-ground/`: 서버·로그인 없이 열 수 있는 3D 훈련장, 재생성 코드, 전투 엔진 시뮬레이터
- `tools/`: 릴리스에 포함된 보조 스크립트

## 실행

Node.js 24 환경에서 `npm ci` 후 `npm run server`를 실행합니다. 기본 바인딩은 `127.0.0.1:18090`이며 `dist/`를 제공합니다. 운영 환경에서는 `PENGUIN_HOST`, `PENGUIN_PORT`, `PENGUIN_DB_PATH`, `PENGUIN_STATIC_DIR`, `PENGUIN_ALLOWED_ORIGINS`, `PENGUIN_TRUST_PROXY`를 설정합니다. 실제 계정 DB와 운영 비밀 설정은 저장소에 없습니다.

훈련장은 [`training-ground/training-ground.html`](training-ground/training-ground.html)을 브라우저에서 직접 열면 됩니다. 훈련장 코드만 남긴 로컬 환경에서도 `python3 training-ground/build-training.py`로 HTML을 다시 만들 수 있습니다.

## 검증

전설 검 스킬 테스트 7개가 통과했습니다. 3D 훈련장 브라우저 테스트에서 어비터의 전방 18×8m 범위·5초 빙결과 아라야시키 적중 시 재사용 시간 감소를 확인했습니다. 전체 서버 테스트는 195개 중 191개가 통과했고, 기존 릴리스에서도 실패하던 탄약 판정, 보스 장비 등급, 구형 총성 번들 테스트 2개가 남아 있습니다.

과거 릴리스 디렉터리, 구버전 클라이언트 번들·백업, `node_modules`, 운영 DB는 포함하지 않습니다.
