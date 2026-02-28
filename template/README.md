# RisuAI TSTL Project

TypeScript로 RisuAI 캐릭터 모듈을 개발하고, TSTL로 Lua 번들을 생성합니다.

## 시작하기

```bash
npm install
npm run build        # → dist/bundle.lua
npm run watch        # 자동 빌드
```

## 기존 Lua 분석

```bash
node analyze.js your-script.lua
```

## AI 에이전트 사용

`AGENT.md`를 컨텍스트에 포함하면 에이전트가 프로젝트 구조와 TSTL 규칙을 이해하고 코드를 작성합니다.

## 구조

| 경로 | 역할 |
|------|------|
| `src/index.ts` | 엔트리포인트. 이벤트 핸들러 등록 |
| `src/modules/` | 기능 모듈 |
| `src/listeners/` | listenEdit 핸들러 |
| `src/data/` | 순수 데이터 |
| `src/utils/lua.ts` | Lua stdlib 래퍼 |
| `types/risuai-lua.d.ts` | RisuAI API 타입 선언 |
| `dist/bundle.lua` | 빌드 결과물 → RisuAI에 붙여넣기 |
| `AGENT.md` | AI 에이전트 가이드 |
| `analyze.js` | Lua 분석 도구 |
