/**
 * RisuAI API 고수준 래퍼
 *
 * getChatVar/setChatVar/getState/setState 등의 로우레벨 API를
 * 안전하고 편리하게 사용하기 위한 유틸리티.
 * sample/ 분석에서 도출된 공통 패턴을 함수화합니다.
 */

import { replace } from "./lua";

// ────────────────────────────────────────────
// Chat Variable 안전 접근
// ────────────────────────────────────────────

/**
 * getChatVar의 nil/"null"/"nil"/빈 문자열을 fallback 값으로 대체하여 반환.
 * @example
 * const name = getChatVarOr(id, "charName", "Unknown");
 */
export function getChatVarOr(id: string, key: string, fallback = ""): string {
  const val = getChatVar(id, key);
  if (val === undefined || val === "null" || val === "nil" || val === "") {
    return fallback;
  }
  return val;
}

/**
 * getChatVar 값을 숫자로 변환하여 반환. 파싱 실패 시 fallback 반환.
 * @example
 * const hp = getChatVarAsNumber(id, "hp", 100);
 */
export function getChatVarAsNumber(id: string, key: string, fallback = 0): number {
  const val = getChatVar(id, key);
  if (val === undefined || val === "null" || val === "nil" || val === "") {
    return fallback;
  }
  const num = tonumber(val);
  return num ?? fallback;
}

// ────────────────────────────────────────────
// State + ChatVar 동기화
// ────────────────────────────────────────────

/**
 * setState와 setChatVar를 동시에 업데이트.
 *
 * 숫자 상태를 State(JSON)과 ChatVar(문자열)에 이중 저장하여
 * LLM 프롬프트에 직접 노출 가능하게 합니다.
 *
 * @param id       - 접근 키
 * @param key      - 저장 키 (State와 ChatVar에 동일한 키 사용)
 * @param value    - 저장할 숫자 값
 *
 * @example
 * setStateAndChatVar(id, "affection", 75);
 * // setState(id, "affection", 75) + setChatVar(id, "affection", "75")
 */
export function setStateAndChatVar(id: string, key: string, value: number): void {
  setState(id, key, value);
  setChatVar(id, key, tostring(value));
}

// ────────────────────────────────────────────
// 채팅 검색
// ────────────────────────────────────────────

/**
 * 채팅 히스토리를 역순으로 탐색하여 패턴에 매칭되는 마지막 메시지를 반환.
 *
 *
 * @param id      - 접근 키
 * @param pattern - Lua 패턴 (JS 정규식 아님!)
 * @returns 매칭된 메시지 객체, 없으면 null
 *
 * @example
 * const msg = findLastMessage(id, "{{img::");
 * if (msg) log(`Found image in: ${msg.data}`);
 */
export function findLastMessage(
  id: string,
  pattern: string,
): RisuaiChatMessage | null {
  const chat = getFullChat(id);
  for (let i = chat.length - 1; i >= 0; i--) {
    const [found] = string.find(chat[i].data, pattern);
    if (found !== undefined) {
      return chat[i];
    }
  }
  return null;
}

/**
 * 채팅 히스토리를 역순으로 탐색하여 패턴에 매칭되는 마지막 메시지의 인덱스를 반환.
 *
 * @param id      - 접근 키
 * @param pattern - Lua 패턴
 * @returns 매칭된 인덱스 (0-based TS), 없으면 -1
 */
export function findLastMessageIndex(id: string, pattern: string): number {
  const chat = getFullChat(id);
  for (let i = chat.length - 1; i >= 0; i--) {
    const [found] = string.find(chat[i].data, pattern);
    if (found !== undefined) {
      return i;
    }
  }
  return -1;
}

// ────────────────────────────────────────────
// HTML 이스케이프
// ────────────────────────────────────────────

/**
 * HTML 엔티티 이스케이프 (editDisplay 출력용).
 *
 *
 * @example
 * const safe = escapeHtml('<script>alert("xss")</script>');
 * // → "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"
 */
export function escapeHtml(s: string): string {
  let result = replace(s, "&", "&amp;");
  result = replace(result, "<", "&lt;");
  result = replace(result, ">", "&gt;");
  result = replace(result, '"', "&quot;");
  result = replace(result, "'", "&#039;");
  return result;
}
