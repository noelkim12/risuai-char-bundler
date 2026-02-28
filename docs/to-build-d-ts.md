가능합니다. Risuai에서 “Lua 스크립트 내부에서 사용할 수 있는 함수들”은 **대부분 `runScripted()`에서 `declareAPI(name, func)`로 Lua 글로벌에 주입되는 JS 함수들**과, 그 위에 얹히는 **`luaCodeWrapper()`가 제공하는 Lua-side helper 함수들** 두 층으로 구성됩니다. 즉 d.ts(정확히는 tstl에서 인식할 타입 선언)로 만들려면:

1) **Injected API(=JS→Lua 글로벌 함수들)** 목록/시그니처  
2) **Wrapper helper(=Lua 코드에서 바로 쓰는 함수들: getChat/LLM/listenEdit/…)** 목록/시그니처  
3) 각 함수가 요구하는 **권한(accessKey 기반 safe/lowLevel)** 제약  
을 정리하면 됩니다.

아래는 레포에서 확인한 “근거 위치”와 함께, d.ts화를 위해 조사한 결과입니다.

> 참고: 코드 검색 도구가 결과 10개 제한이 있어 일부 검색은 누락될 수 있습니다. 전체 확인은 GitHub 코드 검색 UI에서 같이 보세요:  
> https://github.com/kwaroran/Risuai/search?q=declareAPI%28&type=code

---

## A. LuaEngine에 실제로 주입되는 API는 어디서 정의되나?

`src/ts/process/scriptings.ts`에서 Lua 엔진을 만들고(`wasmoon`), `declareAPI = luaEngine.global.set`으로 결정한 뒤 주입합니다.

```ts name=src/ts/process/scriptings.ts url=https://github.com/kwaroran/Risuai/blob/b02a6f1c66edadd71a62791819979b00c5789fca/src/ts/process/scriptings.ts#L1-L96
import { LuaEngine, LuaFactory } from "wasmoon";
/* ... */
declareAPI = (name:string, func:Function) => {
  luaEngine.global.set(name, func)
}
```

즉, **`declareAPI('xxx', fn)`로 등록된 ‘xxx’ 문자열들이 Lua에서 호출 가능한 글로벌 함수 목록**입니다.

---

## B. Lua 코드에서 “직접 사용하게 되는” wrapper helper 함수들

`luaCodeWrapper(code)`는 Lua에서 아래 helper들을 정의합니다(이건 d.ts로도 노출하는 게 좋습니다. 실제로 사용�� Lua는 이 helper를 쓰게 됨):

- `getChat(id, index)` / `getFullChat(id)` / `setFullChat(id, value)`
- `log(value)`
- `getLoreBooks(id, search)` / `loadLoreBooks(id)`
- `LLM(id, prompt, useMultimodal?)` / `axLLM(id, prompt, useMultimodal?)`
- `getCharacterImage(id)` / `getPersonaImage(id)`
- `listenEdit(type, func)` / `callListenMain(...)`(내부)
- `getState(id, name)` / `setState(id, name, value)`
- `async(callback)` (coroutine+Promise 브릿지)

(이 wrapper 전체는 이전 메시지에서 링크한 구간에 있습니다.)

---

## C. Injected API(=declareAPI로 등록되는 함수들) 1차 목록/분류

아래는 `runScripted()` 내부에서 확인되는 injected API들(= `declareAPI('...')`)입니다. **이게 d.ts 생성의 핵심 대상**입니다.

### 1) 변수/상태
- `getChatVar(id: string, key: string): string`
- `setChatVar(id: string, key: string, value: string): void | undefined`  
  - 안전 ID 체크: `ScriptingSafeIds` 또는 `ScriptingEditDisplayIds`에 없으면 아무것도 안 함
- `getGlobalVar(id: string, key: string): string`

근거(일부):
```ts name=src/ts/process/scriptings.ts url=https://github.com/kwaroran/Risuai/blob/b02a6f1c66edadd71a62791819979b00c5789fca/src/ts/process/scriptings.ts#L105-L116
declareAPI('getChatVar', (id:string,key:string) => {
  return ScriptingEngineState.getVar(key)
})
declareAPI('setChatVar', (id:string,key:string, value:string) => { /* safe check */ })
declareAPI('getGlobalVar', (id:string, key:string) => {
  return getGlobalChatVar(key)
})
```

### 2) UI/흐름 제어
- `stopChat(id: string): void`
- `alertError(id: string, value: string): void`
- `alertNormal(id: string, value: string): void`
- `alertInput(id: string, value: string): Promise<string | null | undefined>` (정확한 반환형은 alertInput 구현을 봐야 확정)
- `alertSelect(id: string, value: string[]): Promise<string | null | undefined>`
- `alertConfirm(id: string, value: string): Promise<boolean>`

### 3) 채팅 메시지 접근/수정 (대부분 safe 필요)
- `getChatMain(id: string, index: number): string`  
  - JSON 문자열로 `{ role, data, time } | null` 반환
- `getFullChatMain(id: string): string` (JSON 배열 문자열)
- `setFullChatMain(id: string, value: string): void` (value는 JSON 문자열)
- `getChatLength(id: string): number`
- `setChat(id, index, value): void`
- `setChatRole(id, index, value): void`
- `cutChat(id, start, end): void`
- `removeChat(id, index): void`
- `addChat(id, role, value): void`
- `insertChat(id, index, role, value): void`

### 4) 토크나이즈/슬립
- `getTokens(id: string, value: string): Promise<number | undefined>` (tokenize 반환형에 따라 number/배열 가능성. `tokenize()` 정의 확인 필요)
- `sleep(id: string, time: number): Promise<true | undefined>`

### 5) parser 관련
- `cbs(value: string): string` (Chat parser 결과 문자열로 보임)

### 6) 리로드 트리거
- `reloadDisplay(id: string): void`
- `reloadChat(id: string, index: number): void`

### 7) Low-level 전용(권한 필요: `ScriptingLowLevelIds`)
- `similarity(id: string, source: string, value: string[]): Promise<any>`
- `request(id: string, url: string): Promise<string | undefined>` (JSON 문자열로 `{status,data}` 형태)
- `generateImage(id: string, value: string, negValue?: string): Promise<string | undefined>` (성공 시 `{{inlay::...}}` 형식 문자열)
- `LLMMain(...)`, `axLLMMain(...)`, `simpleLLM(...)` (아래)
- (이미지 조회는 low-level이 아니라 try/catch만 있고 safe 체크는 없음. 다만 getCharacterImageMain/getPersonaImageMain은 wrapper에서 await로 호출됨)

### 8) 이미지/인레이
- `getCharacterImageMain(id: string): Promise<string>` (실패 시 '')
- `getPersonaImageMain(id: string): Promise<string>` (실패 시 '')
- `logMain(value: string): void` (JSON decode 후 console.log)

### 9) 해시
- `hash(id: string, value: string): Promise<string>` (hasher 결과)

### 10) LLM
- `LLMMain(id: string, promptStr: string, useMultimodal?: boolean): Promise<string | undefined>`  
  - 반환은 JSON 문자열(예: `{success:boolean,result:string}`) 형태
- `axLLMMain(...)` 유사
- `simpleLLM(id: string, prompt: string): Promise<{success:boolean,result:string} | undefined>`  
  - 얘는 JSON string이 아니라 object를 반환하는 코드 경로가 보입니다(주의: Lua에서 받을 때 어떤 형태로 매핑되는지 wasmoon 변환 규칙 확인 필요)

---

## D. d.ts로 만들 때 “진짜 편해지는” 추천 구조

tstl 관점에서 네가 원하는 건 보통 이런 형태입니다:

- `declare const getChatVar: (id: string, key: string) => string;` 처럼 **Lua 글로벌로 존재하는 함수** 선언
- wrapper helper는 `declare function getChat(id: string, index: number): ChatMessage | null;` 같은 형태
- Promise/await 브릿지는 wasmoon 쪽 `Promise` userdata를 쓰므로, `Promise<T>` 타입을 따로 선언해두는 게 좋습니다(예: `interface Promise<T> { await(): T; finally(cb: (...args:any)=>any): Promise<T>; }` 등). 이건 wrapper에서 `:await()`를 호출하고 있어서 필요합니다.

---

## E. 다음 액션(정확한 d.ts 생성 위해 추가로 봐야 하는 것)

현재 메시지에서 “조사”는 큰 틀과 목록까지는 가능하지만, **정확한 반환 타입** 몇 개는 외부 함수 구현을 봐야 확정됩니다. 특히:

- `tokenize()`가 number를 반환하는지, 배열을 반환하는지
- `alertInput/alertSelect`가 정확히 무엇을 resolve하는지
- `hasher()` 반환 타입(문자열/hex/base64)
- `requestChatData()` 결과 타입을 Lua에 어떤 형태(JSON string vs object)로 넘기는지

좋아. “주입된 JS API(=declareAPI)” + “luaCodeWrapper helper” 둘 다를 대상으로 **tstl용 d.ts(또는 타입 선언 파일)**를 만들 수 있게, 레포 기준으로 **노출 함수 목록/시그니처/권한 제약**을 조사해서 정리해줄게.

아래 내용은 **커밋 `b02a6f1c...`의 `src/ts/process/scriptings.ts`**를 근거로 했고, 함수가 실제로 어디서 등록되는지도 함께 적었습니다.

---

## 1) Injected API(= `declareAPI('name', fn)`로 Lua 글로벌에 주입되는 함수들)

`runScripted()`에서 엔진 생성 후, 아래 함수들이 Lua 글로벌로 들어갑니다.

### A. Variables / State
근거: `scriptings.ts` `declareAPI('getChatVar'...)` 등  
```ts name=src/ts/process/scriptings.ts url=https://github.com/kwaroran/Risuai/blob/b02a6f1c66edadd71a62791819979b00c5789fca/src/ts/process/scriptings.ts#L105-L116
declareAPI('getChatVar', (id:string,key:string) => { ... })
declareAPI('setChatVar', (id:string,key:string, value:string) => { ... })
declareAPI('getGlobalVar', (id:string, key:string) => { ... })
```

- `getChatVar(id: string, key: string): string`
- `setChatVar(id: string, key: string, value: string): void`  
  - 권한: `id`가 `ScriptingSafeIds` 또는 `ScriptingEditDisplayIds`에 있어야 동작
- `getGlobalVar(id: string, key: string): string`

### B. Flow control / UI
근거: `alert*`, `stopChat` 등  
```ts name=src/ts/process/scriptings.ts url=https://github.com/kwaroran/Risuai/blob/b02a6f1c66edadd71a62791819979b00c5789fca/src/ts/process/scriptings.ts#L117-L152
declareAPI('stopChat', ...)
declareAPI('alertError', ...)
declareAPI('alertNormal', ...)
declareAPI('alertInput', ...)
declareAPI('alertSelect', ...)
declareAPI('alertConfirm', ...)
```

- `stopChat(id: string): void`  *(safe id 필요)*
- `alertError(id: string, value: string): void` *(safe id 필요)*
- `alertNormal(id: string, value: string): void` *(safe id 필요)*
- `alertInput(id: string, value: string): Promise<any>` *(safe id 필요, 반환은 alertInput 구현 확인 필요)*
- `alertSelect(id: string, value: string[]): Promise<any>` *(safe id 필요)*
- `alertConfirm(id: string, value: string): Promise<boolean>` *(safe id 필요)*

### C. Chat read/write (JSON 기반)
근거: `getChatMain/getFullChatMain/setFullChatMain` 등  
```ts name=src/ts/process/scriptings.ts url=https://github.com/kwaroran/Risuai/blob/b02a6f1c66edadd71a62791819979b00c5789fca/src/ts/process/scriptings.ts#L154-L262
declareAPI('getChatMain', ...)
declareAPI('setChat', ...)
declareAPI('setChatRole', ...)
declareAPI('cutChat', ...)
declareAPI('removeChat', ...)
declareAPI('addChat', ...)
declareAPI('insertChat', ...)
declareAPI('getFullChatMain', ...)
declareAPI('setFullChatMain', ...)
declareAPI('getChatLength', ...)
```

- `getChatMain(id: string, index: number): string`
  - JSON 문자열(없으면 `"null"`)
  - 구조: `{ role: 'user'|'char', data: string, time: number }`
- `getFullChatMain(id: string): string`  
  - JSON 문자열 배열
- `setFullChatMain(id: string, value: string): void` *(safe id 필요)*  
  - `value`는 JSON 문자열(배열)
- `getChatLength(id: string): number`
- `setChat(id: string, index: number, value: string): void` *(safe id 필요)*
- `setChatRole(id: string, index: number, value: string): void` *(safe id 필요, user/char로 정규화)*
- `cutChat(id: string, start: number, end: number): void` *(safe id 필요)*
- `removeChat(id: string, index: number): void` *(safe id 필요)*
- `addChat(id: string, role: string, value: string): void` *(safe id 필요, role은 user/char로 정규화)*
- `insertChat(id: string, index: number, role: string, value: string): void` *(safe id 필요)*

### D. Utility
근거: `getTokens`, `sleep`, `cbs`, `logMain`  
```ts name=src/ts/process/scriptings.ts url=https://github.com/kwaroran/Risuai/blob/b02a6f1c66edadd71a62791819979b00c5789fca/src/ts/process/scriptings.ts#L212-L266
declareAPI('getTokens', ...)
declareAPI('sleep', ...)
declareAPI('cbs', ...)
declareAPI('logMain', ...)
```

- `getTokens(id: string, value: string): Promise<any>` *(safe id 필요, tokenize 반환형 확인 필요)*
- `sleep(id: string, timeMs: number): Promise<true>` *(safe id 필요)*
- `cbs(value: any): string` *(id 파라미터가 아예 없음: wrapper와 달리 “무권한” 유틸처럼 동작)*
- `logMain(value: string): void`  
  - `value`는 JSON 문자열로 들어오며 내부에서 `JSON.parse` 후 로그

### E. UI reload
근거:  
```ts name=src/ts/process/scriptings.ts url=https://github.com/kwaroran/Risuai/blob/b02a6f1c66edadd71a62791819979b00c5789fca/src/ts/process/scriptings.ts#L267-L282
declareAPI('reloadDisplay', ...)
declareAPI('reloadChat', ...)
```
- `reloadDisplay(id: string): void` *(safe id 필요)*
- `reloadChat(id: string, index: number): void` *(safe id 필요)*

### F. Low-level access 전용 (네트워크/유사도/이미지 생성/LLM 등)
근거:  
```ts name=src/ts/process/scriptings.ts url=https://github.com/kwaroran/Risuai/blob/b02a6f1c66edadd71a62791819979b00c5789fca/src/ts/process/scriptings.ts#L284-L570
declareAPI('similarity', ...)
declareAPI('request', ...)
declareAPI('generateImage', ...)
declareAPI('hash', ...)
declareAPI('LLMMain', ...)
declareAPI('simpleLLM', ...)
declareAPI('axLLMMain', ...)
```

- `similarity(id: string, source: string, value: string[]): Promise<any>` *(lowLevel id 필요)*
- `request(id: string, url: string): Promise<string>` *(lowLevel id 필요)*  
  - JSON 문자열 `{status:number,data:string}`
  - URL 길이/https 강제/분당 5회 제한/특정 도메인 차단
- `generateImage(id: string, prompt: string, negPrompt?: string): Promise<string>` *(lowLevel id 필요)*  
  - 결과는 `{{inlay::...}}` 같은 문자열
- `hash(id: string, value: string): Promise<any>` *(현재 코드상 lowLevel 체크가 없음. 단, 안전/권한 정책상 문서화는 필요)*
- `LLMMain(id: string, promptStrJson: string, useMultimodal?: boolean): Promise<string>` *(lowLevel id 필요)*  
  - JSON 문자열 `{success:boolean,result:string}`
- `axLLMMain(id: string, promptStrJson: string, useMultimodal?: boolean): Promise<string>` *(lowLevel id 필요)*
- `simpleLLM(id: string, prompt: string): Promise<{success:boolean,result:string}>` *(lowLevel id 필요)*

### G. Character/persona read/write
근거:  
```ts name=src/ts/process/scriptings.ts url=https://github.com/kwaroran/Risuai/blob/b02a6f1c66edadd71a62791819979b00c5789fca/src/ts/process/scriptings.ts#L572-L684
declareAPI('getName', ...)
declareAPI('setName', ...)
declareAPI('getDescription', ...)
declareAPI('setDescription', ...)
declareAPI('getCharacterFirstMessage', ...)
declareAPI('setCharacterFirstMessage', ...)
declareAPI('getPersonaName', ...)
declareAPI('getPersonaDescription', ...)
declareAPI('getAuthorsNote', ...)
declareAPI('getBackgroundEmbedding', ...)
declareAPI('setBackgroundEmbedding', ...)
```

- `getName(id: string): string`
- `setName(id: string, name: string): void` *(safe id 필요)*
- `getDescription(id: string): string` *(safe id 필요)*
- `setDescription(id: string, desc: string): void` *(safe id 필요)*
- `getCharacterFirstMessage(id: string): string`
- `setCharacterFirstMessage(id: string, data: string): boolean | void` *(safe id 필요, string 아니면 false)*
- `getPersonaName(id: string): string`
- `getPersonaDescription(id: string): string`
- `getAuthorsNote(id: string): string`
- `getBackgroundEmbedding(id: string): string` *(safe id 필요)*
- `setBackgroundEmbedding(id: string, data: string): boolean | void` *(safe id 필요)*

### H. Lorebook 관련
근거:  
```ts name=src/ts/process/scriptings.ts url=https://github.com/kwaroran/Risuai/blob/b02a6f1c66edadd71a62791819979b00c5789fca/src/ts/process/scriptings.ts#L686-L783
declareAPI('getLoreBooksMain', ...)
declareAPI('upsertLocalLoreBook', ...)
declareAPI('loadLoreBooksMain', ...)
```

- `getLoreBooksMain(id: string, search: string): string | void`  
  - JSON 문자열 반환(조건 안 맞으면 void)
- `upsertLocalLoreBook(id: string, name: string, content: string, options: {alwaysActive?:boolean; insertOrder?:number; key?:string; secondKey?:string; regex?:boolean;}): void` *(safe id 필요)*
- `loadLoreBooksMain(id: string, reserve: number): Promise<string | void>` *(lowLevel id 필요)*  
  - JSON 문자열 배열

### I. Image inlay (읽기)
근거:
```ts name=src/ts/process/scriptings.ts url=https://github.com/kwaroran/Risuai/blob/b02a6f1c66edadd71a62791819979b00c5789fca/src/ts/process/scriptings.ts#L377-L437
declareAPI('getCharacterImageMain', async (id:string) => { ... })
declareAPI('getPersonaImageMain', async (id:string) => { ... })
```

- `getCharacterImageMain(id: string): Promise<string>` (실패/없음이면 `''`)
- `getPersonaImageMain(id: string): Promise<string>` (실패/없음이면 `''`)

### J. “마지막 메시지” (주의: 중복 등록 버그)
근거: `getCharacterLastMessage/getUserLastMessage`가 2번씩 선언됨(같은 이름 재등록)  
```ts name=src/ts/process/scriptings.ts url=https://github.com/kwaroran/Risuai/blob/b02a6f1c66edadd71a62791819979b00c5789fca/src/ts/process/scriptings.ts#L880-L955
declareAPI('getCharacterLastMessage', ...)
declareAPI('getUserLastMessage', ...)
declareAPI('getCharacterLastMessage', ...) // 중복
declareAPI('getUserLastMessage', ...)      // 중복
```

- `getCharacterLastMessage(id: string): string`
- `getUserLastMessage(id: string): string`

d.ts에는 1회만 선언하면 됩니다.

---

## 2) Wrapper helper API(= luaCodeWrapper가 Lua에서 정의하는 “권장” 함수들)

`luaCodeWrapper(code)`는 injected API를 조합해 아래 함수를 “Lua에서 쓰기 편하게” 제공합니다.

근거:
```ts name=src/ts/process/scriptings.ts url=https://github.com/kwaroran/Risuai/blob/b02a6f1c66edadd71a62791819979b00c5789fca/src/ts/process/scriptings.ts#L1148-L1297
function luaCodeWrapper(code:string){ return ` ... ` }
```

### A. JSON decode/encode로 감싼 Chat helpers
- `getChat(id: string, index: number): { role: string; data: string; time: number } | null`
- `getFullChat(id: string): Array<{ role: string; data: string; time: number }>`
- `setFullChat(id: string, value: any): void`
- `log(value: any): void`

### B. Lorebooks / LLM / image
- `getLoreBooks(id: string, search: string): any[]`
- `loadLoreBooks(id: string): any[]` *(내부적으로 `loadLoreBooksMain(id):await()` 사용)*
- `LLM(id: string, prompt: any, useMultimodal?: boolean): any`
- `axLLM(id: string, prompt: any, useMultimodal?: boolean): any`
- `getCharacterImage(id: string): string`
- `getPersonaImage(id: string): string`

### C. Edit listener system
- `listenEdit(type: 'editRequest'|'editDisplay'|'editInput'|'editOutput', func: (id: string, value: any, meta: any) => any): void`
- 내부 디스패처 `callListenMain(...)` (TS에서 mode가 edit*일 때 이것을 호출)

### D. 상태 저장 helper (chatVar에 JSON으로 저장)
- `getState<T>(id: string, name: string): T`
- `setState<T>(id: string, name: string, value: T): void`

### E. async 브릿지
- `async(callback)` → coroutine + Promise를 감싸서 `:await()` 기반 패턴을 가능하게 함  
  - d.ts에서 `Promise` 타입( Lua userdata )을 어떻게 모델링할지 결정이 필요

---

## 3) d.ts(타입 선언) 만들 때의 핵심 포인트 3개

1) **Injected API는 “글로벌 함수”로 선언**  
   - 예: `declare function getChatVar(id: string, key: string): string;`
2) **Wrapper helper도 “글로벌 함수”로 선언**  
   - 실제 사용자 Lua는 wrapper helper를 쓰게 되므로, 여기 타입이 진짜 체감에 중요
3) **권한 모델을 타입으로 표현할지(선택사항)**  
   - 예: `type SafeId = string & { __brand: 'SafeId' }` 같은 “브랜딩”으로 구분 가능하지만, 실제로는 런타임에서만 체크됨  
   - 문서 주석으로 “requires safe/lowLevel”을 남기는 게 현실적으로 유용
