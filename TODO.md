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
- [x] `extract.js` Phase 8 Character Card 추출 추가 (`character/` 8개 파일: 6x `.txt` 텍스트 필드 + `alternate_greetings.json` + `metadata.json`)
- [x] `extract.js` Phase 5 에셋 타입별 서브디렉토리 분리 (`assets/icons/`, `assets/additional/`, `assets/emotions/`, `assets/other/`)
- [x] `analyze-card` Unified Variables에서 Lua writer/reader를 파일명 대신 `writtenBy`/`readBy` owner로 표시
- [x] core 테스트 전략 문서 추가 (`docs/core-test-strategy.md`)
- [x] `packages/core/scripts` 파이프라인 분석 문서 추가 (`../docs/core-scripts-pipeline.md`)
- [x] extract 파이프라인 문서 갱신 (`../docs/core-scripts-pipeline.md`에 Phase 8 Character Card 추출 반영)
- [x] `pack.js` Character Card round-trip 병합 지원 (`character/` -> `card.json`)
- [x] lorebook 폴더를 실제 디렉토리로 추출하고 raw metadata는 `lorebooks/manifest.json`에 보존
- [x] `lorebooks/manifest.json` 정책 확정 (extract always writes manifest, build/pack manifest-first)
- [x] repack contract & validation 문서화 (`../docs/repack-contract-validation.md`)
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

- [x] 병합 우선순위(contract) 문서화 (`card.json` vs 추출 컴포넌트)
- [x] `--out` 경로 해석 규칙 문서화 (파일 경로 vs 디렉토리)
- [x] `pack -> extract` 검증 체크리스트 문서화

#### Lorebook & Regex Policy

- [ ] regex 파일 누락/불일치 시 에러 정책 문서화

#### Format Support Decisions

- [ ] strict cover 모드 추가 여부 결정 (현재는 1x1 fallback)
- [ ] `lua/*.lua -> triggerscript` 역변환 지원 여부 결정/설계

#### Architecture Restructure (source of truth: `docs/architecture-proposal.md`)

- [x] `template/` 퇴역 결정 반영: 루트 역할을 scaffold 패키지에서 workspace/product 루트로 재정의
- [x] `bin/create.js`, `template/`, README의 scaffold 흐름 제거/축소 계획 수립
- [x] 구조 제안 문서 작성 (`docs/architecture-proposal.md`)

##### Phase 1: Core 내부 정리 (domain/node/cli 분리, scripts/ 제거)

- [x] 1차 계약 테스트 보강 (package root import smoke, CLI smoke, 실제 workflow seam 고정)
- [x] `src/shared` ↔ `scripts/shared` helper parity 정리 (`risu-api`, `extract-helpers` 중심)
- [ ] **1-1. `src/domain/` 생성 + 순수 로직 분리**
  - [ ] `src/shared/`에서 Node.js 의존성 없는 순수 로직을 `src/domain/`으로 이동
  - [ ] `domain/card/` — CardData 파싱, CBS 분석
  - [ ] `domain/lorebook/` — lorebook 구조 분석
  - [ ] `domain/regex/` — regex script 처리
  - [ ] `domain/analyze/` — 분석 로직 (상관관계, 통계)
  - [ ] 완료 기준: domain/ 내 모든 함수가 Node.js import 0
- [ ] **1-2. `src/node/` 정비 (I/O 어댑터 전용)**
  - [ ] `node/fs-helpers.ts` — ensureDir, writeJson, writeText, writeBinary
  - [ ] `node/png.ts` — PNG chunk 파싱 (Buffer 의존)
  - [ ] `node/card-io.ts` — parseCardFile (fs + fflate)
  - [ ] 완료 기준: node/가 domain/에만 의존, 역방향 의존 없음
- [ ] **1-3. `src/cli/` 생성 + scripts/*.js 로직 TS 이관**
  - [ ] `cli/main.ts` — subcommand dispatcher (bin/risu-core.js의 로직 흡수)
  - [ ] `cli/extract.ts` ← `scripts/extract.js` + `scripts/extract/phases.js`, `parsers.js`
  - [ ] `cli/pack.ts` ← `scripts/pack.js`
  - [ ] `cli/analyze.ts` ← `scripts/analyze.js` + `scripts/analyze/*.js`
  - [ ] `cli/analyze-card.ts` ← `scripts/analyze-card.js` + `scripts/analyze-card/*.js`
  - [ ] `cli/build.ts` ← `scripts/build-components.js`
  - [ ] 이관 원칙: JS→TS 변환, strict mode, I/O는 node/ 사용, 순수 로직은 domain/ 사용
  - [ ] 이관 전 각 커맨드별 integration test 작성 (현재 동작 고정)
  - [ ] 완료 기준: 모든 CLI 커맨드가 src/cli/에서 동작, 기존 테스트 통과
- [ ] **1-4. `bin/risu-core.js` → `dist/cli/main.js` 직접 호출**
  - [ ] `execSync` 제거, 같은 프로세스에서 `require('../dist/cli/main').run()` 호출
  - [ ] 완료 기준: `risu-core extract/pack/analyze` 등 기존 CLI 동일 동작
- [ ] **1-5. `scripts/shared/` bridge 삭제**
  - [ ] `scripts/shared/risu-api.js` 삭제
  - [ ] `scripts/shared/extract-helpers.js` 삭제
  - [ ] `scripts/shared/analyze-helpers.js` 삭제
  - [ ] `scripts/shared/uri-resolver.js` 삭제
- [ ] **1-6. `scripts/` 폴더 삭제**
  - [ ] 모든 직접 구현체 이관 확인 후 `scripts/` 디렉토리 제거
  - [ ] `scripts/rpack_map.bin` → `src/node/` 또는 `assets/`로 이동
  - [ ] `scripts/package.json` 삭제
- [ ] **1-7. barrel export 정비 + 계약 테스트 최종 보강**
  - [ ] `src/index.ts` — types + domain만 export (브라우저 safe)
  - [ ] `src/node/index.ts` — Node.js I/O 전용 export
  - [ ] package.json exports 필드 확인: `"."` = types+domain, `"./node"` = I/O
  - [ ] CLI smoke + domain unit + node integration 전체 통과 확인

##### Phase 2: VSCode Extension 구조 확장

- [ ] **2-1. `services/` 계층 도입 (core import 시작)**
  - [ ] `services/card-service.ts` — core domain + node를 조합하는 서비스
  - [ ] `services/analysis-service.ts` — 분석 기능 서비스
  - [ ] 완료 기준: core `"."`, `"./node"` import 정상 동작
- [ ] **2-2. `providers/` 도입 (VSCode UI 제공자)**
  - [ ] `providers/tree-provider.ts` — TreeView 제공자
  - [ ] `providers/codelens-provider.ts` — CodeLens 제공자 (필요시)
  - [ ] 완료 기준: VSCode UI 제공자 1개 이상 동작
- [ ] **2-3. `commands/` 도입 (command palette 바인딩)**
  - [ ] extract, pack, analyze 등 핵심 기능 command palette 연동
  - [ ] 완료 기준: command palette에서 core 기능 호출 가능
- [ ] **2-4. `panels/` 도입 (webview host 준비)**
  - [ ] `panels/card-panel.ts` — webview panel skeleton + 메시지 라우팅 준비
  - [ ] 완료 기준: 빈 webview panel 생성 가능

##### Phase 3: Contracts + Webview

- [ ] **3-1. `packages/contracts/` 생성**
  - [ ] `contracts/src/messages.ts` — Extension ↔ Webview 메시지 프로토콜 (discriminated union)
  - [ ] `contracts/src/ui-types.ts` — PanelState, TreeItemData 등 공유 UI 타입
  - [ ] `contracts/src/index.ts` — barrel export
  - [ ] `contracts/package.json` — 의존성 0, 순수 타입만
  - [ ] 완료 기준: typed message map 존재, vscode + webview 양쪽에서 import 가능
- [ ] **3-2. `packages/webview/` 생성 (ui-mockup/ 승격)**
  - [ ] webview UI 프레임워크 선정 + vite 빌드 설정
  - [ ] contracts import 연동
  - [ ] `messaging.ts` — postMessage wrapper (contracts 기반 typed 통신)
  - [ ] 완료 기준: vite 빌드 + contracts import 동작
- [ ] **3-3. Extension ↔ Webview postMessage 연동**
  - [ ] vscode panels/ → webview 양방향 typed 메시지 전달
  - [ ] 완료 기준: 양방향 메시지 round-trip 검증
- [ ] **3-4. `ui-mockup/` 퇴역**
  - [ ] webview 패키지로 이관 완료 확인 후 `ui-mockup/` 디렉토리 삭제
