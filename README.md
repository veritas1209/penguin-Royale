# Penguin Royale

Pulse Arcade에서 제공하는 펭귄 익스트랙션 게임의 **2026-09-23 배포 릴리스 스냅샷**입니다. Jetson의 `bluecap-extraction/releases/20260923-map-update-110`을 기준으로 게시했습니다.

## 기술 스택

- 클라이언트: TypeScript, Three.js, Vite, CSS
- 서버: Node.js 24, `ws` WebSocket, Node 내장 `node:sqlite`
- 공통 게임 규칙: `shared/*.ts`
- 배포: systemd로 Node 서버 실행, Pulse Arcade의 aiohttp 프록시를 통해 `/games/penguin-extraction/`에 연결

## 구조

```text
src/          Three.js 장면, 입력, 사운드, UI
shared/       아이템·무기·방어구·이동·월드 공통 규칙
server/       인증, SQLite, 원정 상태, 적 AI, 전리품, WebSocket
server/tests/ 서버 규칙 테스트
public/       원본 정적 자산
dist/         이 릴리스에서 실제 제공한 빌드 결과와 게임 자산
tools/        보조 스크립트
```

## 실행

Node.js 24 환경에서 `npm ci` 후 `npm run server`를 실행합니다. 서버는 기본적으로 `127.0.0.1:18090`에 바인딩하며 `dist/`를 제공합니다. `PENGUIN_HOST`, `PENGUIN_PORT`, `PENGUIN_DB_PATH`, `PENGUIN_STATIC_DIR`, `PENGUIN_ALLOWED_ORIGINS`, `PENGUIN_TRUST_PROXY` 환경변수로 배포 환경을 설정할 수 있습니다. 실제 운영 서비스와 포털 연결 예시는 `server/bluecap-extraction.service` 및 Pulse Arcade의 `server/penguin_proxy.py`를 참고하세요.

현재 배포 HTML은 `dist/assets/index-map-update-110.js`와 `dist/assets/index-ui-hotfix-30.css`를 사용합니다. 이 저장소는 **실행 중인 릴리스의 보관본**이며, 과거 빌드·백업·운영 계정 데이터·SQLite DB·`node_modules`는 포함하지 않습니다.

## 검증 상태

서버 규칙 테스트 명령은 npm run server:test입니다. 2026-09-23 원본 운영 릴리스에서도 ammo.test.js의 관통·폭발·화상 테스트와 world-loot-contract.test.js의 보스 장비 등급 테스트가 실패했습니다. 이 저장소는 해당 상태를 그대로 보관합니다. 현재 릴리스에 없는 과거 번들을 검사하던 테스트 2개는 게시본에서 제외했습니다.

배포 화면: [Penguin Royale](https://222.96.173.194/games/penguin-extraction/).