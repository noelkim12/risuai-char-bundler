# TODO

## Repack/Extract 정책 체크리스트

### Done

- [x] 루트 `AGENTS.md` 추가 (TODO 업데이트/잔여 작업 리마인드 규칙 명시)
- [x] `pack.js` 구현 (`png`, `charx`, `charx-jpg`)
- [x] `lorebooks/manifest.json` 기반 lorebook 재구성
- [x] `regex/_order.json` 기반 customScripts 재구성
- [x] `module.risum` 재생성 로직 추가
- [x] 현재 제한사항 문서화 (`docs/what_we_extract.md`, `template/AGENT.md`, `pack --help`)
- [x] `template/scripts/analyze-card/correlators.js` 추가 (`buildUnifiedCBSGraph` 구현, 브리지/정렬/트렁케이션)
- [x] `analyze-card.js` 종합 분석기 구현 (4-phase pipeline: collect → correlate → analyze → report)
- [x] `analyze-card/collectors.js` — lorebook/regex/variables/HTML/TS/Lua CBS 수집기
- [x] `analyze-card/collectors.js` — card.json 대신 추출 폴더(lorebooks/ regex/ variables/ html/) 우선 읽기 + card.json fallback
- [x] `analyze-card/constants.js` — MAX_* 상수, ELEMENT_TYPES, CBS_OPS
- [x] `analyze-card/correlators.js` — unified CBS graph + lorebook-regex 상관관계
- [x] `analyze-card/lorebook-analyzer.js` — 폴더 트리, 활성화 통계, 키워드 분석
- [x] `analyze-card/reporting.js` — 8섹션 Markdown 리포트 생성기
- [x] `analyze-card/reporting/htmlRenderer.js` — Chart.js 포함 자체완결 HTML 리포트
- [x] `analyze-card/reporting/htmlRenderer.js` — sharedVars 키 불일치(`lorebookEntries`/`regexScripts`) 대응 패치
- [x] `extract.js` Phase 9 통합 (analyze-card.js 자동 실행, non-fatal)
- [x] `extract.js` Lua 분석 호출에 `--json` 추가 (lua/*.analysis.json 자동 생성)
- [x] `phase4_extractTriggerLua` 파일명 fallback 개선 (comment 없으면 Lua 함수명 추론 사용)
- [x] `analyze-card` Unified Variables에서 Lua writer/reader를 파일명 대신 `writtenBy`/`readBy` owner로 표시
- [x] **Monorepo Restructure (Tasks 1-15)**
  - [x] Task 1: Root monorepo configuration (package.json, workspaces)
  - [x] Task 2: packages/core scaffold + package.json
  - [x] Task 3: Core types extraction from workbench.ts
  - [x] Task 4: shared/ TypeScript conversion (4 files)
  - [x] Task 5: packages/core tsconfig.json setup
  - [x] Task 6: Copy extract pipeline to core
  - [x] Task 7: Copy pack.js + rpack_map.bin to core
  - [x] Task 8: Copy analyze pipeline + fix luaparse path
  - [x] Task 9: Copy analyze-card pipeline to core
  - [x] Task 10: Copy build-components.js + shared/ JS to core
  - [x] Task 11: Core CLI entry point + index.ts
  - [x] Task 12: packages/vscode scaffold
  - [x] Task 13: Root .gitignore update
  - [x] Task 14: vitest setup for packages/core
  - [x] Task 15: TODO.md update + root test.js cleanup
### Remaining

#### Repack Contract & Validation

- [ ] 병합 우선순위(contract) 문서화 (`card.json` vs 추출 컴포넌트)
- [ ] `--out` 경로 해석 규칙 문서화 (파일 경로 vs 디렉토리)
- [ ] `pack -> extract` 검증 체크리스트 문서화

#### Lorebook & Regex Policy

- [ ] `lorebooks/manifest.json` 미존재 시 정책 확정 (fallback 유지/자동 생성)
- [ ] regex 파일 누락/불일치 시 에러 정책 문서화

#### Format Support Decisions

- [ ] strict cover 모드 추가 여부 결정 (현재는 1x1 fallback)
- [ ] `lua/*.lua -> triggerscript` 역변환 지원 여부 결정/설계

#### VSCode Extension Architecture

- [x] `template/` 퇴역 결정 반영: 루트 역할을 scaffold 패키지에서 workspace/product 루트로 재정의
- [x] `bin/create.js`, `template/`, README의 scaffold 흐름 제거/축소 계획 수립
- [ ] `packages/core` 런타임 경계 재구성 (`domain`/`node`/`cli` 분리, `scripts/` 복제 구조 축소)
- [ ] `packages/vscode` 구조 확장 (`services/`, `providers/`, `panels/`, `messaging/` 도입)
- [ ] Webview UI 패키지 분리 (`ui-mockup/` 정리 후 `packages/webview` 또는 `packages/ui`로 승격)
- [ ] Core↔Extension↔Webview DTO/메시지 계약(JSON schema 또는 TS contracts) 정의
