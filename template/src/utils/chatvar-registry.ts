/**
 * Chat Variable Registry — 타입 안전한 채팅 변수 관리
 *
 * 변수를 선언적으로 정의하고, 컴파일 타임에 키 오타와 타입 불일치를 감지합니다.
 * 숫자 변수는 setState + setChatVar 이중 저장 패턴을 자동으로 적용합니다.
 *
 * @example
 * const vars = createRegistry({
 *   greeting: { default: "0" },
 *   hp:       { default: 100 },
 * });
 *
 * // onStart에서 초기화 (nil인 변수만 default로 세팅)
 * vars.init(id);
 *
 * // 타입 안전 접근
 * vars.get(id, "greeting")      // → string
 * vars.get(id, "hp")            // → number
 * vars.set(id, "greeting", "1") // ✅
 * vars.set(id, "hp", 42)        // ✅
 * vars.set(id, "hp", "42")      // ❌ 컴파일 에러
 * vars.get(id, "typo")          // ❌ 컴파일 에러
 */

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────

/** 변수 정의: default 값의 타입(string | number)으로 변수 타입이 결정됨 */
interface VarDef {
  readonly default: string | number;
}

/** 스키마: 변수 이름 → 정의 */
type VarSchema = Record<string, VarDef>;

/** default 타입에서 get/set 값 타입 추론 */
type InferValue<D extends VarDef> = D["default"] extends number
  ? number
  : string;

// ────────────────────────────────────────────
// Registry
// ────────────────────────────────────────────

/**
 * 타입 안전한 Chat Variable 레지스트리를 생성합니다.
 *
 * - string 변수: `setChatVar`로 저장, `getChatVar`로 읽기
 * - number 변수: `setState` + `setChatVar` 이중 저장,
 *   `getChatVar` → `tonumber` 변환으로 읽기
 *
 * @param schema 변수 이름 → `{ default: 기본값 }` 매핑
 */
export function createRegistry<T extends VarSchema>(schema: T) {
  // ── 내부 헬퍼 ──

  /** nil-like 값 판별 (getChatVarOr와 동일 기준) */
  function _isNil(val: string | undefined): boolean {
    return val === undefined || val === "null" || val === "nil" || val === "";
  }

  /** 단일 키를 기본값으로 쓰기 */
  function _writeDefault(id: string, key: string): void {
    const def = (schema as VarSchema)[key];
    if (typeof def.default === "number") {
      setState(id, key, def.default);
      setChatVar(id, key, tostring(def.default));
    } else {
      setChatVar(id, key, def.default as string);
    }
  }

  // ── Public API ──

  /**
   * 변수 값을 읽습니다. nil/빈 문자열이면 default를 반환합니다.
   *
   * - string 변수 → `string` 반환
   * - number 변수 → `number` 반환 (파싱 실패 시 default)
   */
  function get<K extends string & keyof T>(
    id: string,
    key: K,
  ): InferValue<T[K]> {
    const def = (schema as VarSchema)[key];
    const val = getChatVar(id, key);
    if (_isNil(val)) {
      return def.default as InferValue<T[K]>;
    }
    if (typeof def.default === "number") {
      const num = tonumber(val);
      return (num !== undefined ? num : def.default) as InferValue<T[K]>;
    }
    return val as InferValue<T[K]>;
  }

  /**
   * 변수 값을 씁니다.
   *
   * - string 변수 → `setChatVar` 호출
   * - number 변수 → `setState` + `setChatVar` 동시 호출
   */
  function set<K extends string & keyof T>(
    id: string,
    key: K,
    value: InferValue<T[K]>,
  ): void {
    const def = (schema as VarSchema)[key];
    if (typeof def.default === "number") {
      setState(id, key, value);
      setChatVar(id, key, tostring(value as number));
    } else {
      setChatVar(id, key, value as string);
    }
  }

  /**
   * 미초기화(nil) 변수만 기본값으로 세팅합니다.
   * `onStart`에서 호출하여 모든 변수를 안전하게 초기화합니다.
   *
   * @example
   * onStart = (id) => { vars.init(id); };
   */
  function init(id: string): void {
    for (const key in schema) {
      const val = getChatVar(id, key);
      if (_isNil(val)) {
        _writeDefault(id, key);
      }
    }
  }

  /**
   * 지정 키들을 기본값으로 강제 리셋합니다.
   * 키 미지정 시 전체 변수를 리셋합니다.
   *
   * @example
   * // 특정 키만 리셋
   * vars.reset(id, ["hp", "greeting"]);
   *
   * // 전체 리셋
   * vars.reset(id);
   */
  function reset(id: string, keys?: Array<string & keyof T>): void {
    if (keys) {
      for (const key of keys) {
        _writeDefault(id, key);
      }
    } else {
      for (const key in schema) {
        _writeDefault(id, key);
      }
    }
  }

  /** 등록된 모든 키를 배열로 반환합니다. */
  function allKeys(): Array<string & keyof T> {
    const result: string[] = [];
    for (const key in schema) {
      result[result.length] = key;
    }
    return result as Array<string & keyof T>;
  }

  return { get, set, init, reset, keys: allKeys };
}
