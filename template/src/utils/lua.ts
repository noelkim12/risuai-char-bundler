/**
 * Lua stdlib 래퍼
 *
 * TSTL에서 Lua 문자열 함수를 편하게 쓰기 위한 유틸리티.
 * string.gmatch는 for...of로 순회 불가, string.gsub는 튜플 반환 등의
 * 문제를 래퍼로 해결합니다.
 */

/** Lua 패턴 매칭 결과를 배열로 수집 (string.gmatch 래퍼) */
export function collectMatches(s: string, pattern: string): string[] {
  const results: string[] = [];
  const iter = string.gmatch(s, pattern);
  while (true) {
    const [m] = iter();
    if (m === undefined) break;
    results.push(m);
  }
  return results;
}

/** 줄바꿈 기준 분리 */
export function splitLines(s: string): string[] {
  return collectMatches(s, "[^\r\n]+");
}

/** string.gsub 래퍼 — 결과 문자열만 반환 (count 무시) */
export function replace(s: string, pattern: string, repl: string): string {
  const [result] = string.gsub(s, pattern, repl);
  return result;
}

/** 파이프(|) 구분 문자열 → 배열 */
export function splitPipe(s: string): string[] {
  if (!s || s === "") return [];
  return collectMatches(s, "[^|]+");
}

/** 배열 → 파이프(|) 구분 문자열 */
export function joinPipe(arr: string[]): string {
  return table.concat(arr, "|");
}

/** 앞뒤 공백 제거 (Lua 패턴 기반 trim) */
export function trim(s: string): string {
  const [r1] = string.gsub(s, "^%s+", "");
  const [r2] = string.gsub(r1, "%s+$", "");
  return r2;
}

/** 값을 min~max 범위로 제한 */
export function clamp(value: number, min: number, max: number): number {
  return math.max(min, math.min(max, value));
}

/** 문자열에서 첫 번째 정수를 추출. 실패 시 defaultVal 반환 */
export function extractInt(s: string, defaultVal = 0): number {
  const [numStr] = string.match(s, "%-?%d+");
  if (numStr === undefined) return defaultVal;
  return tonumber(numStr) ?? defaultVal;
}

/**
 * 리터럴 구분자로 분리 (Lua 패턴 특수문자 자동 이스케이프)
 * @example splitLiteral("a.b.c", ".") → ["a", "b", "c"]
 */
export function splitLiteral(s: string, sep: string): string[] {
  if (!s || s === "") return [];
  // Lua 패턴 특수문자 이스케이프
  const [safeSep] = string.gsub(sep, "([%(%)%.%%%+%-%*%?%[%]%^%$])", "%%%1");
  return collectMatches(s, `[^${safeSep}]+`);
}

/** 구분자(comma)로 안전하게 이어붙이기. 빈 문자열이면 추가분만 반환 */
export function appendComma(full: string, add: string): string {
  if (!full || full === "") return add;
  if (!add || add === "") return full;
  return `${full}, ${add}`;
}

/** 구분자(pipe)로 안전하게 이어붙이기. 빈 문자열이면 추가분만 반환 */
export function appendPipe(full: string, add: string): string {
  if (!full || full === "") return add;
  if (!add || add === "") return full;
  return `${full}|${add}`;
}
