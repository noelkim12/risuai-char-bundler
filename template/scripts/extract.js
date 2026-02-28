#!/usr/bin/env node
/**
 * extract.js — RisuAI Character Card Extractor
 *
 * 캐릭터 카드 파일(.charx, .png)을 파싱하여 구성요소를 추출합니다.
 *
 * Phase 1: 캐릭터 카드 → JSON (card.json)
 * Phase 2: globalLore → lorebooks/ (폴더 구조 유지)
 * Phase 3: customscript(regex) → regex/
 * Phase 4: triggerlua 스크립트 → lua/
 *
 * Usage:
 *   node extract.js <file.charx|file.png> [options]
 *
 * Options:
 *   --out <dir>     출력 디렉토리 (기본: ./extracted)
 *   --json-only     Phase 1만 실행 (card.json만 출력)
 *   --help, -h      도움말
 */

const fs = require("fs");
const path = require("path");

// ═══════════════════════════════════════════════════════════
// CLI argument parsing
// ═══════════════════════════════════════════════════════════

const argv = process.argv.slice(2);
const helpMode = argv.includes("-h") || argv.includes("--help") || argv.length === 0;
const jsonOnly = argv.includes("--json-only");
const outIdx = argv.indexOf("--out");
const outArg = outIdx >= 0 ? argv[outIdx + 1] : null;
const outDir = outArg || ".";
const filePath = argv.find((a) => !a.startsWith("-") && a !== outArg && a !== "--out" && a !== "--json-only");

if (helpMode || !filePath) {
  console.log(`
  🐿️ RisuAI Character Card Extractor

  Usage:  node extract.js <file.charx|file.png> [options]

  Options:
    --out <dir>     출력 디렉토리 (기본: . 프로젝트 루트)
    --json-only     Phase 1만 실행 (card.json만 출력)
    -h, --help      도움말

  Phases:
    1. 캐릭터 카드 파싱 → card.json
    2. globalLore 추출 → lorebooks/ (폴더 구조 유지)
    3. customscript(regex) 추출 → regex/
    4. triggerlua 스크립트 추출 → lua/

  Examples:
    node extract.js mychar.charx
    node extract.js mychar.png --out ./other-dir
    node extract.js mychar.charx --json-only
`);
  process.exit(0);
}

if (!fs.existsSync(filePath)) {
  console.error(`\n  ❌ 파일을 찾을 수 없습니다: ${filePath}\n`);
  process.exit(1);
}

// ═══════════════════════════════════════════════════════════
// Utility functions
// ═══════════════════════════════════════════════════════════

/** 파일명에서 사용할 수 없는 문자를 제거하고 안전한 이름으로 변환 */
function sanitizeFilename(name, fallback = "unnamed") {
  if (!name || typeof name !== "string") return fallback;
  const cleaned = name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\.\./g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[._]+|[._]+$/g, "")
    .substring(0, 100);
  return cleaned || fallback;
}

/** 디렉토리가 없으면 재귀적으로 생성 */
function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

/** JSON을 예쁘게 포맷하여 파일로 저장 */
function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

/** 텍스트 파일 저장 */
function writeText(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf-8");
}

/** 같은 이름의 파일이 이미 있으면 _1, _2 등 접미어를 붙여 유일한 이름 반환 */
function uniquePath(dir, baseName, ext) {
  let candidate = path.join(dir, `${baseName}${ext}`);
  let counter = 1;
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${baseName}_${counter}${ext}`);
    counter++;
  }
  return candidate;
}

// ═══════════════════════════════════════════════════════════
// RPack Decoder (byte substitution cipher)
// ═══════════════════════════════════════════════════════════

let _decodeMap = null;

function initRPack() {
  if (_decodeMap) return true;
  const mapPath = path.join(__dirname, "rpack_map.bin");
  if (!fs.existsSync(mapPath)) {
    console.error("  ⚠️  rpack_map.bin 없음 — module.risum 디코딩 불가");
    return false;
  }
  const mapData = fs.readFileSync(mapPath);
  if (mapData.length < 512) {
    console.error("  ⚠️  rpack_map.bin 손상 — module.risum 디코딩 불가");
    return false;
  }
  _decodeMap = mapData.subarray(256, 512);
  return true;
}

function decodeRPack(data) {
  if (!_decodeMap) return data;
  const result = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = _decodeMap[data[i]];
  }
  return result;
}

// ═══════════════════════════════════════════════════════════
// PNG tEXt chunk parser
// ═══════════════════════════════════════════════════════════

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

/**
 * PNG 파일에서 tEXt 청크를 추출합니다.
 * 캐릭터 카드는 'chara' 또는 'ccv3' 키에 base64-encoded JSON으로 저장됩니다.
 */
function parsePngChunks(buf) {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("유효한 PNG 파일이 아닙니다.");
  }

  const chunks = {};
  let pos = 8;

  while (pos + 12 <= buf.length) {
    const length = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);

    if (pos + 12 + length > buf.length) break;

    const data = buf.subarray(pos + 8, pos + 8 + length);
    pos += 12 + length; // 4(len) + 4(type) + data + 4(crc)

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

// ═══════════════════════════════════════════════════════════
// CharX (ZIP) parser — uses fflate
// ═══════════════════════════════════════════════════════════

function parseCharx(buf) {
  let unzipSync;
  try {
    ({ unzipSync } = require("fflate"));
  } catch {
    console.error("  ❌ fflate 패키지가 필요합니다. npm install 을 실행하세요.");
    process.exit(1);
  }

  const unzipped = unzipSync(new Uint8Array(buf));
  const result = { card: null, moduleData: null, assets: {} };

  for (const filename in unzipped) {
    if (filename === "card.json") {
      result.card = JSON.parse(Buffer.from(unzipped[filename]).toString("utf-8"));
    } else if (filename === "module.risum") {
      result.moduleData = Buffer.from(unzipped[filename]);
    } else {
      result.assets[filename] = unzipped[filename];
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════
// module.risum parser (RPack → JSON)
// ═══════════════════════════════════════════════════════════

/**
 * module.risum 바이너리를 파싱하여 RisuModule 객체를 반환합니다.
 *
 * 포맷:
 *   [1 byte: magic 111] [1 byte: version 0]
 *   [4 bytes LE: mainLen] [mainLen bytes: RPack-encoded JSON]
 *   반복: [1 byte: 1=asset, 0=EOF] [4 bytes LE: assetLen] [assetLen bytes: RPack-encoded asset]
 */
function parseModuleRisum(buf) {
  if (!initRPack()) return null;

  let pos = 0;

  const magic = buf[pos++];
  if (magic !== 111) {
    console.error(`  ⚠️  module.risum: 잘못된 매직 넘버 (${magic}, 기대: 111)`);
    return null;
  }

  const version = buf[pos++];
  if (version !== 0) {
    console.error(`  ⚠️  module.risum: 지원하지 않는 버전 (${version})`);
    return null;
  }

  const mainLen = buf.readUInt32LE(pos);
  pos += 4;

  if (pos + mainLen > buf.length) {
    console.error("  ⚠️  module.risum: 데이터 크기 불일치");
    return null;
  }

  const mainData = buf.subarray(pos, pos + mainLen);
  const decoded = decodeRPack(mainData);

  let parsed;
  try {
    parsed = JSON.parse(Buffer.from(decoded).toString("utf-8"));
  } catch (e) {
    console.error("  ⚠️  module.risum: JSON 파싱 실패 —", e.message);
    return null;
  }

  if (parsed.type !== "risuModule") {
    console.error(`  ⚠️  module.risum: 잘못된 타입 (${parsed.type})`);
    return null;
  }

  return parsed.module;
}

// ═══════════════════════════════════════════════════════════
// PHASE 1: Parse character card → JSON
// ═══════════════════════════════════════════════════════════

function phase1_parseCard(inputPath) {
  const ext = path.extname(inputPath).toLowerCase();
  const buf = fs.readFileSync(inputPath);

  console.log(`\n  📦 Phase 1: 캐릭터 카드 파싱`);
  console.log(`     입력: ${path.basename(inputPath)} (${(buf.length / 1024).toFixed(1)} KB)`);

  // ── CharX format ──
  if (ext === ".charx") {
    console.log("     포맷: CharX (ZIP)");

    const { card, moduleData, assets } = parseCharx(buf);
    if (!card) {
      console.error("  ❌ card.json을 찾을 수 없습니다.");
      process.exit(1);
    }

    console.log(`     spec: ${card.spec || "unknown"}`);
    console.log(`     이름: ${card.data?.name || "unknown"}`);

    // module.risum이 있으면 디코딩하여 card에 병합
    if (moduleData) {
      console.log(`     module.risum: ${(moduleData.length / 1024).toFixed(1)} KB`);
      const mod = parseModuleRisum(moduleData);
      if (mod) {
        console.log(`     모듈 이름: ${mod.name || "unknown"}`);

        // triggerscript 병합
        if (mod.trigger && mod.trigger.length > 0) {
          card.data = card.data || {};
          card.data.extensions = card.data.extensions || {};
          card.data.extensions.risuai = card.data.extensions.risuai || {};
          card.data.extensions.risuai.triggerscript = mod.trigger;
          console.log(`     triggerscript: ${mod.trigger.length}개 병합됨`);
        }

        // customScripts(regex) 병합
        if (mod.regex && mod.regex.length > 0) {
          card.data.extensions = card.data.extensions || {};
          card.data.extensions.risuai = card.data.extensions.risuai || {};
          card.data.extensions.risuai.customScripts = mod.regex;
          console.log(`     customScripts: ${mod.regex.length}개 병합됨`);
        }

        // lorebook 병합 (module의 lorebook은 별도 키로 보존)
        if (mod.lorebook && mod.lorebook.length > 0) {
          card.data.extensions = card.data.extensions || {};
          card.data.extensions.risuai = card.data.extensions.risuai || {};
          card.data.extensions.risuai._moduleLorebook = mod.lorebook;
          console.log(`     lorebook (module): ${mod.lorebook.length}개 병합됨`);
        }
      }
    }

    const assetCount = Object.keys(assets).length;
    if (assetCount > 0) {
      console.log(`     에셋: ${assetCount}개`);
    }

    return card;
  }

  // ── PNG format ──
  if (ext === ".png") {
    console.log("     포맷: PNG");

    const chunks = parsePngChunks(buf);
    const keys = Object.keys(chunks);
    console.log(`     tEXt 청크: ${keys.join(", ") || "(없음)"}`);

    // ccv3 우선, 없으면 chara
    let jsonStr = null;
    if (chunks.ccv3) {
      jsonStr = Buffer.from(chunks.ccv3, "base64").toString("utf-8");
      console.log("     사용 청크: ccv3 (V3)");
    } else if (chunks.chara) {
      jsonStr = Buffer.from(chunks.chara, "base64").toString("utf-8");
      console.log("     사용 청크: chara (V2)");
    }

    if (!jsonStr) {
      console.error("  ❌ 캐릭터 데이터 청크를 찾을 수 없습니다 (chara/ccv3).");
      process.exit(1);
    }

    let card;
    try {
      card = JSON.parse(jsonStr);
    } catch (e) {
      console.error("  ❌ JSON 파싱 실패:", e.message);
      process.exit(1);
    }

    console.log(`     spec: ${card.spec || "unknown"}`);
    console.log(`     이름: ${card.data?.name || card.name || "unknown"}`);

    return card;
  }

  // ── JSON format (직접 JSON 파일) ──
  if (ext === ".json") {
    console.log("     포맷: JSON");
    const card = JSON.parse(buf.toString("utf-8"));
    console.log(`     spec: ${card.spec || "unknown"}`);
    console.log(`     이름: ${card.data?.name || card.name || "unknown"}`);
    return card;
  }

  console.error(`  ❌ 지원하지 않는 파일 포맷: ${ext}`);
  console.error("     지원 포맷: .charx, .png, .json");
  process.exit(1);
}

// ═══════════════════════════════════════════════════════════
// PHASE 2: Extract lorebooks
// ═══════════════════════════════════════════════════════════

/**
 * character_book.entries (CharCard 표준) → 개별 JSON 파일
 * module lorebook (RisuAI 내부 loreBook[]) → 개별 JSON 파일
 *
 * 폴더 구조:
 *   lorebooks/{entry.json}                      (폴더 없는 항목)
 *   lorebooks/{folder_name}/{entry.json}        (폴더 있는 항목)
 *   lorebooks/_folder_{folder_name}.json        (mode==='folder'인 폴더 메타)
 */
function phase2_extractLorebooks(card, outputDir) {
  console.log(`\n  📚 Phase 2: Lorebook 추출`);

  const lorebooksDir = path.join(outputDir, "lorebooks");
  let count = 0;

  // ── Source 1: character_book.entries (표준 CharCard 포맷) ──
  const charBook = card.data?.character_book;
  if (charBook && charBook.entries && charBook.entries.length > 0) {
    console.log(`     character_book.entries: ${charBook.entries.length}개`);

    for (let i = 0; i < charBook.entries.length; i++) {
      const entry = charBook.entries[i];
      const name = sanitizeFilename(entry.name || entry.comment || `entry_${i}`);
      const folder = entry.folder ? sanitizeFilename(entry.folder) : null;

      // folder 메타 항목(mode === 'folder')은 별도 처리
      if (entry.mode === "folder") {
        const metaPath = uniquePath(lorebooksDir, `_folder_${name}`, ".json");
        writeJson(metaPath, entry);
        count++;
        continue;
      }

      const dir = folder ? path.join(lorebooksDir, folder) : lorebooksDir;
      const outPath = uniquePath(dir, name, ".json");
      writeJson(outPath, entry);
      count++;
    }
  }

  // ── Source 2: module lorebook (RisuAI loreBook[] 포맷) ──
  const moduleLorebook = card.data?.extensions?.risuai?._moduleLorebook;
  if (moduleLorebook && moduleLorebook.length > 0) {
    console.log(`     module lorebook: ${moduleLorebook.length}개`);

    for (let i = 0; i < moduleLorebook.length; i++) {
      const lore = moduleLorebook[i];
      const name = sanitizeFilename(lore.comment || `lore_${i}`);
      const folder = lore.folder ? sanitizeFilename(lore.folder) : null;

      // folder 메타 항목
      if (lore.mode === "folder") {
        const metaPath = uniquePath(lorebooksDir, `_folder_${name}`, ".json");
        writeJson(metaPath, lore);
        count++;
        continue;
      }

      const dir = folder ? path.join(lorebooksDir, folder) : lorebooksDir;
      const outPath = uniquePath(dir, name, ".json");
      writeJson(outPath, lore);
      count++;
    }

    // _moduleLorebook은 임시 키이므로 card.json에서 제거
    delete card.data.extensions.risuai._moduleLorebook;
  }

  if (count === 0) {
    console.log("     (lorebook 없음)");
  } else {
    console.log(`     ✅ ${count}개 lorebook → ${path.relative(".", lorebooksDir)}/`);
  }

  return count;
}

// ═══════════════════════════════════════════════════════════
// PHASE 3: Extract customscripts (regex)
// ═══════════════════════════════════════════════════════════

/**
 * extensions.risuai.customScripts → 개별 JSON 파일
 *
 * 구조:
 *   regex/{comment}.json
 *
 * customscript: { comment, in, out, type, flag?, ableFlag? }
 */
function phase3_extractRegex(card, outputDir) {
  console.log(`\n  🔧 Phase 3: Regex(customscript) 추출`);

  const regexDir = path.join(outputDir, "regex");
  const scripts = card.data?.extensions?.risuai?.customScripts;

  if (!scripts || scripts.length === 0) {
    console.log("     (customscript 없음)");
    return 0;
  }

  console.log(`     customScripts: ${scripts.length}개`);

  let count = 0;
  for (let i = 0; i < scripts.length; i++) {
    const script = scripts[i];
    const name = sanitizeFilename(script.comment || `regex_${i}`);
    const outPath = uniquePath(regexDir, name, ".json");
    writeJson(outPath, script);
    count++;
  }

  console.log(`     ✅ ${count}개 regex → ${path.relative(".", regexDir)}/`);
  return count;
}

// ═══════════════════════════════════════════════════════════
// PHASE 4: Extract triggerlua scripts
// ═══════════════════════════════════════════════════════════

/**
 * extensions.risuai.triggerscript → effect 배열에서 type === 'triggerlua' 추출
 *
 * 구조:
 *   lua/{triggerscript.comment}.lua
 *
 * triggerscript: { comment, type, conditions, effect: [{ type, code }] }
 * triggerCode:   { type: 'triggerlua', code: string }
 */
function phase4_extractTriggerLua(card, outputDir) {
  console.log(`\n  🌙 Phase 4: TriggerLua 스크립트 추출`);

  const luaDir = path.join(outputDir, "lua");
  const triggers = card.data?.extensions?.risuai?.triggerscript;

  if (!triggers || triggers.length === 0) {
    console.log("     (triggerscript 없음)");
    return 0;
  }

  console.log(`     triggerscript: ${triggers.length}개`);

  let luaCount = 0;
  let triggerCount = 0;

  for (let i = 0; i < triggers.length; i++) {
    const trigger = triggers[i];
    const effects = trigger.effect || [];

    for (let j = 0; j < effects.length; j++) {
      const effect = effects[j];

      if (effect.type === "triggerlua" && effect.code) {
        triggerCount++;
        const baseName = sanitizeFilename(trigger.comment || `trigger_${i}`);
        // 같은 triggerscript에 여러 triggerlua가 있을 수 있으므로 접미어 처리
        const name = effects.filter((e) => e.type === "triggerlua").length > 1
          ? `${baseName}_${j}`
          : baseName;
        const outPath = uniquePath(luaDir, name, ".lua");

        // 파일 상단에 메타데이터를 코멘트로 추가
        const header = [
          `-- Extracted from triggerscript: ${trigger.comment || "(unnamed)"}`,
          `-- Trigger type: ${trigger.type || "unknown"}`,
          `-- Low-level access: ${trigger.lowLevelAccess ? "yes" : "no"}`,
          "",
        ].join("\n");

        writeText(outPath, header + effect.code);
        luaCount++;
      }
    }
  }

  if (luaCount === 0) {
    console.log("     (triggerlua 없음 — triggercode 또는 다른 effect 타입만 존재)");
  } else {
    console.log(`     ✅ ${luaCount}개 lua 스크립트 (${triggerCount}개 triggerlua effect) → ${path.relative(".", luaDir)}/`);
  }

  return luaCount;
}

// ═══════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════

function main() {
  console.log(`\n  🐿️ RisuAI Character Card Extractor\n`);

  // Phase 1: Parse
  const card = phase1_parseCard(filePath);

  // Save card.json
  const resolvedOutDir = path.resolve(outDir);
  ensureDir(resolvedOutDir);
  const cardJsonPath = path.join(resolvedOutDir, "card.json");
  writeJson(cardJsonPath, card);
  console.log(`\n     ✅ card.json → ${path.relative(".", cardJsonPath)}`);

  if (jsonOnly) {
    console.log("\n  완료 (--json-only)\n");
    return;
  }

  // Phase 2: Lorebooks
  phase2_extractLorebooks(card, resolvedOutDir);

  // Phase 3: Regex/customscripts
  phase3_extractRegex(card, resolvedOutDir);

  // Phase 4: TriggerLua
  phase4_extractTriggerLua(card, resolvedOutDir);

  // Summary
  console.log("\n  ────────────────────────────────────────");
  console.log(`  📊 추출 완료 → ${path.relative(".", resolvedOutDir)}/`);
  console.log("  ────────────────────────────────────────\n");
}

main();
