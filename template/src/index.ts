/**
 * Entry Point — 이벤트 핸들러 등록
 *
 * 이 파일은 TSTL 번들의 진입점입니다.
 * 모듈을 import하고 이벤트 핸들러를 등록하세요.
 */

// ── RisuAI Global Handlers (risuai-lua.d.ts에 없는 글로벌 핸들러) ──
declare let onOutput: ((id: string) => void) | undefined;
declare let onInput: ((id: string) => void) | undefined;
declare let onButtonClick: ((id: string, choice: string) => void) | undefined;

import { collectMatches, replace, trim, clamp } from "./utils/lua";
// import { getChatVarOr, getChatVarAsNumber, setStateAndChatVar, findLastMessage, escapeHtml } from "./utils/risuai";
// import { createRegistry } from "./utils/chatvar-registry";

// ── 예시: Chat Variable Registry ──
// analyze.js --markdown 결과의 Suggested Schema를 복사하여 사용하세요.
//
// const vars = createRegistry({
//   greeting: { default: "0" },
//   hp:       { default: 100 },
// });
//
// onStart에서 초기화:
//   vars.init(id);
//
// 타입 안전 접근:
//   vars.get(id, "greeting")   // → string
//   vars.set(id, "hp", 42)     // → number (setState + setChatVar 자동)

// ── 예시: onOutput 핸들러 ──

onOutput = async((id: string) => {
  const chat = getFullChat(id);
  const last = chat[chat.length - 1];

  // TODO: 여기에 로직 추가
});

// ── 예시: editDisplay 리스너 ──

// listenEdit("editDisplay", (id, value, meta) => {
//   return value;
// });
