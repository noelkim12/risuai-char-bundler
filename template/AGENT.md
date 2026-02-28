# AGENT.md — RisuAI TSTL Project Guide

이 프로젝트는 RisuAI 캐릭터 모듈을 TypeScript로 작성하고, TypeScriptToLua(TSTL)로 단일 Lua 파일로 번들링합니다.

## 프로젝트 구조

```
src/
├── index.ts          ← 엔트리포인트. 이벤트 핸들러 등록만 담당
├── utils/lua.ts      ← Lua stdlib 래퍼 (collectMatches, replace, splitPipe 등)
├── utils/chatvar-registry.ts ← Chat Variable Registry (타입 안전 상태 관리)
├── modules/          ← 기능 모듈 (자유롭게 생성)
├── listeners/        ← listenEdit 핸들러
└── data/             ← 순수 데이터 테이블
types/
└── risuai-lua.d.ts   ← RisuAI Lua API 타입 선언 (전역 함수/인터페이스)
dist/
└── bundle.lua        ← 빌드 결과물. 이것을 RisuAI에 붙여넣음
lorebooks/              ← 추출된 로어북 JSON (폴더 구조 유지)
regex/                  ← 추출된 커스텀 스크립트(정규식) JSON
lua/                    ← 추출된 Lua 트리거 스크립트 (마이그레이션 원본)
scripts/
├── analyze.js        ← 기존 Lua 파일 분석 도구 (npm run analyze)
├── extract.js        ← 캐릭터 카드 추출 도구 (npm run extract)
└── rpack_map.bin     ← RPack 디코딩용 바이트 치환 맵 (512 bytes)
```

## 빌드

```bash
npm run build          # dist/bundle.lua 생성
npm run watch          # 파일 변경 시 자동 빌드
```

```bash
npm run extract        # 캐릭터 카드에서 컴포넌트 추출
```

`tsconfig.json`의 `tstl.luaBundle`이 모든 모듈을 하나의 `bundle.lua`로 합칩니다.

## 캐릭터 카드 추출 (extract.js)

`.charx` 또는 `.png` 캐릭터 카드 파일에서 구성 요소를 추출합니다.

```bash
npm run extract -- mychar.charx              # 전체 추출 (→ 프로젝트 루트)
npm run extract -- mychar.png --out ./out    # 출력 디렉토리 지정
npm run extract -- mychar.charx --json-only  # card.json만 추출
```

### 추출 단계

| Phase | 설명 | 출력 |
|-------|------|------|
| 1 | 캐릭터 카드 파싱 | `card.json` |
| 2 | globalLore 추출 | `lorebooks/` (폴더 구조 유지) |
| 3 | customscript(regex) 추출 | `regex/` |
| 4 | triggerlua 스크립트 추출 | `lua/` |

### 지원 포맷

- **`.charx`**: ZIP 아카이브 (card.json + module.risum + assets)
- **`.png`**: tEXt 청크에 base64 인코딩된 카드 데이터 (ccv3 > chara 우선)
- **`.json`**: 직접 JSON 캐릭터 카드

### 마이그레이션 워크플로우

1. `npm run extract -- original.charx` → 프로젝트 루트에 추출
2. `card.json` 검토 → 캐릭터 기본 정보 확인
3. `lorebooks/` → 로어북 데이터 검토 및 편집
4. `regex/` → 커스텀 스크립트(정규식) 검토
5. `lua/` → Lua 트리거 스크립트 → `src/` 로 마이그레이션
6. `npm run analyze -- lua/*.lua` → 추출된 Lua 코드 분석

## 새 파일 만들기

### 모듈 (src/modules/)

```typescript
// src/modules/emotionTracker.ts
/** 감정 상태 추적 모듈 */

export function process(id: string): void {
  const emotion = getChatVar(id, "currentEmotion");
  // ...
}
```

`index.ts`에서 import:
```typescript
import * as EmotionTracker from "./modules/emotionTracker";
```

### 리스너 (src/listeners/)

```typescript
// src/listeners/chatFilter.ts
/** 채팅 필터 리스너 */

export function handle(id: string, value: unknown, meta: unknown): unknown {
  const data = value as string;
  // 변환 로직
  return data;
}
```

`index.ts`에서 등록:
```typescript
import { handle as handleChatFilter } from "./listeners/chatFilter";
listenEdit("editDisplay", handleChatFilter);
```

### 데이터 (src/data/)

로직 없이 순수 데이터만 export. 대형 테이블(캐릭터 목록, 아이템 데이터 등)은 여기서 관리.

```typescript
// src/data/characters.ts
export const CHARACTER_TABLE: Record<string, { name: string; age: number }> = {
  char_001: { name: "Sakura", age: 17 },
  // ...
};
```

## TSTL 핵심 규칙

### 1. 전역 함수의 this: void

`types/risuai-lua.d.ts`의 선언에는 `this: void`가 이미 포함되어 있지 않습니다.
`tsconfig.json`에 `"noImplicitSelf": true`가 설정되어 있어서 모든 함수가 자동으로 self 파라미터 없이 컴파일됩니다.

새로운 전역 API를 d.ts에 추가할 때:
```typescript
// tsconfig에 noImplicitSelf: true이므로 this: void 불필요
declare function myNewApi(id: string, value: string): string;
```

### 2. 배열 인덱싱 자동 변환

TS의 0-based 인덱싱이 Lua의 1-based로 자동 변환됩니다.
```typescript
const arr = [10, 20, 30];
arr[0]  // → Lua: arr[1], 값 10 ✅
```

**주의**: `getChat(id, index)`에 전달하는 인덱스는 RisuAI 내부 인덱스이므로 변환하면 안 됩니다. RisuAI API에 전달하는 숫자 인덱스는 그대로 사용하세요.

### 3. string.gmatch — for...of 불가

Lua의 `string.gmatch`는 이터레이터를 반환하지만 TSTL의 `for...of`로 순회할 수 없습니다.

```typescript
// ❌ 컴파일은 되지만 런타임 에러
for (const m of string.gmatch(s, pattern)) { }

// ✅ 래퍼 사용
import { collectMatches } from "./utils/lua";
const matches = collectMatches(s, "[^|]+");
```

### 4. string.gsub — 튜플 반환

```typescript
// ❌ 타입 에러: [string, number] 반환
const result = string.gsub(s, "\n", " ");

// ✅ 구조분해 또는 래퍼
const [cleaned] = string.gsub(s, "\n", " ");

// ✅ 래퍼 사용
import { replace } from "./utils/lua";
const cleaned = replace(s, "\n", " ");
```

### 5. as const 리터럴 타입 주의

`as const`로 만든 리터럴 타입은 비교 연산에서 문제가 생길 수 있습니다.
```typescript
// ⚠️ "hello" (리터럴) !== string 비교 문제
const MODES = { A: "modeA", B: "modeB" } as const;

// ✅ 일반 객체 사용
const MODES = { A: "modeA", B: "modeB" };
```

### 6. Lua 패턴 ≠ 정규식

TSTL은 JS 정규식(`/pattern/`)을 지원하지 않습니다. Lua 패턴을 사용하세요.

| JS 정규식 | Lua 패턴 |
|-----------|---------|
| `\d+` | `%d+` |
| `\s+` | `%s+` |
| `[^\n]+` | `[^\n]+` |
| `.` (any) | `.` |
| `(group)` | `(group)` |
| `[^a-z]` | `[^a-z]` |

### 7. os.date 반환 타입

```typescript
// "*t" 옵션은 LuaDateInfoResult 반환
const now = os.date("*t") as LuaDateInfoResult;
now.year; now.month; now.day; now.hour; now.min;

// 포맷 문자열은 string 반환
const timeStr = os.date("%H:%M") as string;
```

### 8. pcall 에러 처리

```typescript
const [ok, err] = pcall(() => {
  // 에러가 날 수 있는 코드
  const result = someApi(id).await();
});
if (!ok) {
  log(`Error: ${tostring(err)}`);
}
```

## RisuAI API 패턴

### 상태 관리 (Chat Variables) — Raw API

직접 RisuAI API를 호출하는 방식입니다. 단순한 경우에만 사용하세요.

```typescript
// 읽기
const value = getChatVar(id, "myVar");

// 쓰기 (SAFE id 필요 — onOutput, onInput 등에서 받은 id)
setChatVar(id, "myVar", "newValue");

// JSON 상태 (복잡한 객체)
const state = getState<MyState>(id, "gameState");
setState(id, "gameState", { ...state, score: state.score + 1 });
```

### 상태 관리 — Chat Variable Registry (권장)

`createRegistry()`를 사용하면 **컴파일 타임에 키 오타와 타입 불일치를 감지**할 수 있습니다.
기존 `setChatVar`/`getChatVar` 직접 호출 대신 이 레지스트리를 사용하세요.

#### 기본 사용법

```typescript
// src/modules/myModule.ts
import { createRegistry } from "../utils/chatvar-registry";

// 변수 선언 — default 값의 타입이 get/set 타입을 결정
const vars = createRegistry({
  greeting:  { default: "0" },     // string 변수
  hp:        { default: 100 },       // number 변수 (setState+setChatVar 이중 저장)
  playerName: { default: "" },     // string 변수
});

// onStart에서 초기화 (nil인 변수만 default로 세팅)
onStart = (id) => { vars.init(id); };

// 타입 안전 접근
vars.get(id, "greeting")       // → string
vars.get(id, "hp")             // → number
vars.set(id, "greeting", "1")  // ✅
vars.set(id, "hp", 42)          // ✅
vars.set(id, "hp", "42")       // ❌ 컴파일 에러 (number 변수에 string)
vars.get(id, "typo")            // ❌ 컴파일 에러 (존재하지 않는 키)
```

#### API 레퍼런스

| 메서드 | 설명 |
|--------|------|
| `vars.get(id, key)` | 값 읽기. nil이면 default 반환. number 변수는 자동 `tonumber` |
| `vars.set(id, key, value)` | 값 쓰기. number 변수는 `setState`+`setChatVar` 이중 저장 |
| `vars.init(id)` | nil인 변수만 default로 초기화. `onStart`에서 호출 |
| `vars.reset(id, keys?)` | 지정 키(또는 전체)를 default로 강제 리셋 |
| `vars.keys()` | 등록된 모든 키 배열 반환 |

#### number vs string 변수

| default 타입 | 저장 방식 | 읽기 방식 |
|:---:|---|---|
| `string` | `setChatVar(id, key, value)` | `getChatVar(id, key)` → string |
| `number` | `setState(id, key, value)` + `setChatVar(id, key, tostring(value))` | `getChatVar(id, key)` → `tonumber` → number |

#### 마이그레이션 팁

1. `node analyze.js original.lua --markdown`를 실행하면 "Chat Variable Registry (Suggested)" 섹션에 **자동 생성된 스키마**가 포함됩니다.
2. 제안된 스키마를 복사하여 `createRegistry()` 호출로 사용하세요.
3. 기존 코드의 `setChatVar(id, key, val)` → `vars.set(id, key, val)`로 치환.
4. `getChatVar(id, key)` → `vars.get(id, key)`로 치환.
5. `onStart`의 nil-check 초기화 블록 → `vars.init(id)` 한 줄로 대체.

### 이벤트 핸들러

```typescript
// 출력 후 처리
onOutput = async((id: string) => {
  const chat = getFullChat(id);
  // ...
});

// 입력 전 처리
onInput = async((id: string) => {
  // ...
});

// 표시 전 변환 (editDisplay에서는 setChatVar 가능)
listenEdit("editDisplay", (id, value, meta) => {
  let data = value as string;
  // data 변환
  return data;
});

// 출력 텍스트 변환
listenEdit("editOutput", (id, value, meta) => {
  let data = value as string;
  return data;
});
```

### 이미지 생성 (Low-level id 필요)

```typescript
const inlay = generateImage(id, "1girl, smile", "bad quality").await();
// inlay = "{{inlay::...}}" 형태의 마크업
```

### LLM 호출 (Low-level id 필요)

```typescript
const result = LLM(id, [
  { role: "system", content: "You are a helpful assistant." },
  { role: "user", content: "Hello" },
]);
if (result.success) {
  log(result.result);
}
```

## 마이그레이션 가이드 (기존 Lua → TS)

1. `node analyze.js original.lua --markdown`로 구조 파악 + Registry 제안 확인
2. 유틸리티 함수부터 `src/utils/`로 이동
3. 데이터 테이블을 `src/data/`로 분리
4. 기능 단위로 `src/modules/`에 모듈 생성
5. Chat Variable Registry 설정 — 분석 리포트의 Suggested Schema를 `createRegistry()`로 등록
6. `src/index.ts`에서 import하고 이벤트 핸들러 등록
7. `npm run build`로 빌드, 결과물 비교 검증

500줄 이상 함수는 서브함수로 분할을 권장합니다. `analyze.js`가 ⚠️ 표시한 함수가 대상입니다.

## 파일 수정 시 체크리스트

- [ ] `npm run build` 에러 없는지 확인
- [ ] 새 모듈은 `index.ts`에서 import/등록했는지
- [ ] RisuAI API 사용 시 id 파라미터 전달했는지
- [ ] Lua 패턴 사용했는지 (JS 정규식 ❌)
- [ ] 새 API 발견 시 `types/risuai-lua.d.ts`에 추가했는지
- [ ] 상태 변수는 `createRegistry()`로 관리하고 있는지 (직접 setChatVar 지양)
