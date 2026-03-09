import fs from 'fs';
import path from 'path';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

/** Entry from RisuAI charbook that may represent a folder. */
export interface RisuCharbookEntry {
  mode: string;
  keys?: string[];
  name?: string;
  comment?: string;
}

export interface FolderMapOptions {
  nameTransform?: (name: string) => string;
  fallbackName?: string;
}

export interface DecodedCharacterJson {
  jsonStr: string;
  source: string;
}

export interface CBSVarOps {
  reads: Set<string>;
  writes: Set<string>;
}

export function parsePngTextChunks(buf: Buffer): Record<string, string> {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("유효한 PNG 파일이 아닙니다.");
  }

  const chunks: Record<string, string> = {};
  let pos = 8;

  while (pos + 12 <= buf.length) {
    const length = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);

    if (pos + 12 + length > buf.length) break;

    const data = buf.subarray(pos + 8, pos + 8 + length);
    pos += 12 + length;

    if (type === "tEXt") {
      const nullIdx = data.indexOf(0);
      if (nullIdx >= 0) {
        const key = data.toString("ascii", 0, nullIdx);
        const value = data.toString("latin1", nullIdx + 1);
        chunks[key] = value;
      }
    }

    if (type === "IEND") break;
  }

  return chunks;
}

export function decodeCharacterJsonFromChunks(
  chunks: Record<string, string>,
): DecodedCharacterJson | null {
  if (chunks.ccv3)
    return {
      jsonStr: Buffer.from(chunks.ccv3, "base64").toString("utf-8"),
      source: "ccv3",
    };
  if (chunks.chara)
    return {
      jsonStr: Buffer.from(chunks.chara, "base64").toString("utf-8"),
      source: "chara",
    };
  return null;
}

export function buildFolderMap(
  entries: RisuCharbookEntry[],
  opts?: FolderMapOptions,
): Record<string, string> {
  const options = opts || {};
  const nameTransform =
    typeof options.nameTransform === "function"
      ? options.nameTransform
      : (v: string) => v;
  const fallbackName =
    typeof options.fallbackName === "string"
      ? options.fallbackName
      : "unnamed";
  const map: Record<string, string> = {};

  for (const entry of entries) {
    if (entry.mode === "folder" && entry.keys && entry.keys.length > 0) {
      const folderKey = entry.keys[0];
      map[folderKey] = nameTransform(
        entry.name || entry.comment || fallbackName,
      );
    }
  }

  return map;
}

export function resolveFolderName(
  folderRef: string | null | undefined,
  folderMap: Record<string, string>,
  fallbackTransform?: (ref: string) => string,
): string | null {
  if (!folderRef) return null;
  if (Object.prototype.hasOwnProperty.call(folderMap, folderRef))
    return folderMap[folderRef];
  if (typeof fallbackTransform === "function")
    return fallbackTransform(folderRef);
  return folderRef;
}

export function extractCBSVarOps(text: string): CBSVarOps {
  const reads = new Set<string>();
  const writes = new Set<string>();
  if (typeof text !== "string" || text.length === 0) return { reads, writes };

  for (const m of text.matchAll(
    /\{\{(getvar|setvar|addvar)::([^}:]+)/g,
  )) {
    const op = m[1];
    const key = m[2].trim();
    if (!key) continue;
    if (op === "getvar") reads.add(key);
    else writes.add(key);
  }

  return { reads, writes };
}

export function parseCardFile(cardPath: string): unknown {
  const ext = path.extname(cardPath).toLowerCase();
  const buf = fs.readFileSync(cardPath);

  if (ext === ".json") {
    return JSON.parse(buf.toString("utf-8"));
  }

  if (ext === ".png") {
    let chunks: Record<string, string>;
    try {
      chunks = parsePngTextChunks(buf);
    } catch {
      console.error("  ⚠️  --card: 유효한 PNG 파일이 아닙니다.");
      return null;
    }
    const decoded = decodeCharacterJsonFromChunks(chunks);
    if (!decoded) {
      console.error(
        "  ⚠️  --card: PNG에서 캐릭터 데이터를 찾을 수 없습니다.",
      );
      return null;
    }
    try {
      return JSON.parse(decoded.jsonStr);
    } catch {
      console.error("  ⚠️  --card: 캐릭터 데이터 JSON 파싱 실패");
      return null;
    }
  }

  console.error(
    `  ⚠️  --card: 지원하지 않는 형식 (${ext}). .json 또는 .png만 지원합니다.`,
  );
  return null;
}
