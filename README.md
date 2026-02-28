# risu-char-bundler

RisuAI 캐릭터 스크립트를 TypeScript로 작성하고, TypeScriptToLua(TSTL)로 단일 Lua 번들로 빌드하기 위한 CLI 스캐폴더입니다.

## Quick Start

```bash
npx risu-char-bundler my-character
cd my-character
npm install
npm run build
```

빌드 결과는 `dist/bundle.lua`로 생성되며, RisuAI에 붙여 넣어 사용할 수 있습니다.

## CLI Usage

```bash
npx risu-char-bundler <project-name>
```

생성되는 템플릿에는 아래가 포함됩니다.

- `src/` - TypeScript 소스(모듈/리스너/데이터)
- `types/risuai-lua.d.ts` - RisuAI Lua API 타입 선언
- `scripts/analyze.js` - 기존 Lua 스크립트 분석/분할 제안
- `scripts/extract.js` - 캐릭터 카드에서 컴포넌트 추출
- `AGENT.md` - AI 코딩 에이전트 작업 가이드

## Repository Layout

- `bin/create.js` - `npx` 실행 진입점
- `template/` - 스캐폴딩에 사용되는 템플릿 프로젝트
- `sample/` - 분석/검증용 샘플 Lua 및 데이터
- `docs/` - Lua/Risu 관련 참고 문서

## Local Development

```bash
npm install
node bin/create.js playground
```

로컬에서 템플릿이 잘 생성되는지 확인한 뒤, `playground/` 같은 테스트 출력 디렉토리는 커밋하지 않는 것을 권장합니다.

## Publish Notes

- npm `bin` 엔트리: `bin/create.js`
- 배포 포함 파일: `bin/`, `template/` (`package.json`의 `files` 필드)
- 템플릿 내부 의존성은 생성된 프로젝트에서 `npm install`로 설치

## License

MIT
