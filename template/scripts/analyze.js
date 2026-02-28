#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const luaparse = require(path.join(__dirname, "..", "node_modules", "luaparse"));
const RISUAI_API = {
  getChatVar: { cat: "state", access: "injected", rw: "read" },
  setChatVar: { cat: "state", access: "safe", rw: "write" },
  getState: { cat: "state", access: "wrapper", rw: "read" },
  setState: { cat: "state", access: "wrapper", rw: "write" },
  getGlobalVar: { cat: "state", access: "injected", rw: "read" },
  getChat: { cat: "chat", access: "wrapper", rw: "read" },
  getFullChat: { cat: "chat", access: "wrapper", rw: "read" },
  setChat: { cat: "chat", access: "safe", rw: "write" },
  setFullChat: { cat: "chat", access: "safe", rw: "write" },
  getChatLength: { cat: "chat", access: "injected", rw: "read" },
  addChat: { cat: "chat", access: "safe", rw: "write" },
  removeChat: { cat: "chat", access: "safe", rw: "write" },
  cutChat: { cat: "chat", access: "safe", rw: "write" },
  insertChat: { cat: "chat", access: "safe", rw: "write" },
  reloadChat: { cat: "chat", access: "safe", rw: "write" },
  reloadDisplay: { cat: "ui", access: "safe", rw: "write" },
  alertNormal: { cat: "ui", access: "safe", rw: "write" },
  alertError: { cat: "ui", access: "safe", rw: "write" },
  alertInput: { cat: "ui", access: "safe", rw: "write" },
  alertSelect: { cat: "ui", access: "safe", rw: "write" },
  alertConfirm: { cat: "ui", access: "safe", rw: "write" },
  generateImage: { cat: "ai", access: "low-level", rw: "write" },
  LLM: { cat: "ai", access: "low-level", rw: "write" },
  LLMMain: { cat: "ai", access: "low-level", rw: "write" },
  axLLM: { cat: "ai", access: "low-level", rw: "write" },
  axLLMMain: { cat: "ai", access: "low-level", rw: "write" },
  simpleLLM: { cat: "ai", access: "low-level", rw: "write" },
  getName: { cat: "character", access: "injected", rw: "read" },
  setName: { cat: "character", access: "safe", rw: "write" },
  getDescription: { cat: "character", access: "safe", rw: "read" },
  setDescription: { cat: "character", access: "safe", rw: "write" },
  getPersonaName: { cat: "character", access: "injected", rw: "read" },
  getPersonaDescription: { cat: "character", access: "injected", rw: "read" },
  getCharacterImage: { cat: "character", access: "wrapper", rw: "read" },
  getPersonaImage: { cat: "character", access: "wrapper", rw: "read" },
  getCharacterFirstMessage: { cat: "character", access: "injected", rw: "read" },
  getCharacterLastMessage: { cat: "character", access: "injected", rw: "read" },
  getUserLastMessage: { cat: "character", access: "injected", rw: "read" },
  getLoreBooks: { cat: "lore", access: "wrapper", rw: "read" },
  loadLoreBooks: { cat: "lore", access: "wrapper", rw: "read" },
  upsertLocalLoreBook: { cat: "lore", access: "safe", rw: "write" },
  stopChat: { cat: "control", access: "safe", rw: "write" },
  getTokens: { cat: "utility", access: "safe", rw: "read" },
  sleep: { cat: "utility", access: "safe", rw: "write" },
  log: { cat: "utility", access: "wrapper", rw: "write" },
  cbs: { cat: "utility", access: "injected", rw: "read" },
  listenEdit: { cat: "event", access: "wrapper", rw: "write" },
  async: { cat: "utility", access: "wrapper", rw: "read" },
  request: { cat: "network", access: "low-level", rw: "read" },
  similarity: { cat: "ai", access: "low-level", rw: "read" },
  hash: { cat: "utility", access: "low-level", rw: "read" },
};
const LUA_STDLIB_CALLS = new Set(["string", "table", "math", "os", "pcall", "tostring", "tonumber", "type", "ipairs", "pairs", "next", "select", "unpack", "print", "error", "assert"]);
const MAX_MODULES_IN_REPORT = 120;
const argv = process.argv.slice(2);
const markdownMode = argv.includes("--markdown");
const helpMode = argv.includes("-h") || argv.includes("--help") || argv.length === 0;
const filePath = argv.find((a) => !a.startsWith("-"));
if (helpMode || !filePath) {
  console.log("\n  Usage: node analyze.js <file.lua> [--markdown]\n");
  process.exit(0);
}
if (!fs.existsSync(filePath)) {
  console.error(`\n  ❌ 파일을 찾을 수 없습니다: ${filePath}\n`);
  process.exit(1);
}
const src = fs.readFileSync(filePath, "utf-8");
const lines = src.split("\n");
const total = lines.length;
console.log(`\n  🔍 ${path.basename(filePath)} (${total} lines)\n`);
// ═══════════════════════════════════════════════════════════
// PHASE 1: PARSE — luaparse AST extraction
// ═══════════════════════════════════════════════════════════

let ast;
try {
  ast = luaparse.parse(src, { comments: true, locations: true, ranges: true, scope: true, luaVersion: "5.3" });
} catch (e) {
  console.error(`\n  ❌ Parse error at line ${e.line}, col ${e.column}: ${e.message}\n`);
  process.exit(1);
}
const body = ast.body;
const comments = ast.comments || [];
const safeArray = (v) => (Array.isArray(v) ? v : []);
const lineStart = (n) => (n && n.loc && n.loc.start ? n.loc.start.line : 0);
const lineEnd = (n) => (n && n.loc && n.loc.end ? n.loc.end.line : 0);
const lineCount = (n) => {
  const s = lineStart(n);
  const e = lineEnd(n);
  return s > 0 && e >= s ? e - s + 1 : 0;
};
const nodeKey = (n) => (n && Array.isArray(n.range) ? `${n.type}@${n.range[0]}:${n.range[1]}` : `${n && n.type}@${lineStart(n)}:${lineEnd(n)}`);
const callArgs = (n) => (Array.isArray(n && n.arguments) ? n.arguments : Array.isArray(n && n.args) ? n.args : []);
const strLit = (n) => {
  if (!n || typeof n !== "object") return null;
  if (n.type === "StringLiteral") {
    if (typeof n.value === "string") return n.value;
    if (typeof n.raw === "string") {
      const m = n.raw.match(/^['"](.*)['"]$/s);
      return m ? m[1] : n.raw;
    }
    return null;
  }
  if (n.type === "Literal" && typeof n.value === "string") return n.value;
  return null;
};
function exprName(n) {
  if (!n || typeof n !== "object") return null;
  if (n.type === "Identifier") return n.name || null;
  if (n.type === "MemberExpression") {
    const b = exprName(n.base);
    const i = exprName(n.identifier);
    return b && i ? `${b}${n.indexer === ":" ? ":" : "."}${i}` : i || b;
  }
  if (n.type === "IndexExpression") {
    const b = exprName(n.base) || "";
    const idx = exprName(n.index) || strLit(n.index) || "?";
    return `${b}[${idx}]`;
  }
  return null;
}

function assignName(n) {
  return n && n.type === "Identifier" ? n.name : exprName(n);
}
function directCalleeName(callNode) {
  const base = callNode && callNode.base;
  return base && base.type === "Identifier" ? base.name : null;
}
function sanitizeName(name, fallback) {
  const cleaned = String(name || "").toLowerCase().replace(/[\s/]+/g, "_").replace(/[<>:"'`|!?@#$%^&*()+={}\[\],.;~\\]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  return cleaned || fallback;
}
function toModuleName(name) {
  return String(name || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "") || "module";
}
function prefixOf(name) {
  const head = String(name || "").split(/[.:]/)[0];
  if (!head.includes("_")) return null;
  const p = head.split("_")[0];
  return p.length >= 3 ? p : null;
}
function maxBlankRun(fromLine, toLine) {
  let run = 0;
  let max = 0;
  for (let i = Math.max(1, fromLine); i <= Math.min(total, toLine); i++) {
    if ((lines[i - 1] || "").trim() === "") {
      run += 1;
      if (run > max) max = run;
    } else run = 0;
  }
  return max;
}


// ═══════════════════════════════════════════════════════════
// PHASE 2: COLLECT — single-pass AST walker
// ═══════════════════════════════════════════════════════════

const isSectionSeparatorComment = (v) => {
  const t = String(v || "").trim();
  return /^[\s=═-]{3,}$/.test(t) || /[=═]{3,}/.test(t);
};
const collected = {
  functions: [],
  calls: [],
  apiCalls: [],
  handlers: [],
  dataTables: [],
  stateVars: new Map(),
  functionIndexByName: new Map(),
  prefixBuckets: new Map(),
};

const fnHandled = new Set();
const fnStack = [];

function ensureFnIndex(name) {
  if (!collected.functionIndexByName.has(name)) collected.functionIndexByName.set(name, []);
  return collected.functionIndexByName.get(name);
}

function ensureStateVar(key) {
  if (!collected.stateVars.has(key)) {
    collected.stateVars.set(key, { key, readBy: new Set(), writtenBy: new Set(), apis: new Set(), firstWriteValue: null, firstWriteFunction: null, firstWriteLine: 0, hasDualWrite: false });
  }
  return collected.stateVars.get(key);
}

function currentFn(explicitParent) {
  return explicitParent || fnStack[fnStack.length - 1] || null;
}

function registerFunction(node, rawName, opts) {
  const startLine = lineStart(node);
  const baseName = rawName || `anonymous_L${startLine}`;
  let normalized = sanitizeName(baseName, `fn_l${startLine}`).replace(/-/g, "_");
  // Disambiguate when nested function redefines a name that already exists at a different scope
  const existingFns = collected.functionIndexByName.get(normalized);
  if (existingFns && existingFns.length > 0) {
    const parentFn = opts && opts.parentFunction ? opts.parentFunction : null;
    const existingParent = existingFns[0].parentFunction;
    if (parentFn !== existingParent) {
      normalized = `${normalized}_l${startLine}`;
    }
  }
  const rec = {
    name: normalized,
    displayName: baseName,
    startLine,
    endLine: lineEnd(node),
    lineCount: lineCount(node),
    isLocal: Boolean(opts && opts.isLocal),
    isAsync: Boolean(opts && opts.isAsync),
    params: safeArray(node.parameters).map((p) => exprName(p) || "...").filter(Boolean),
    parentFunction: opts && opts.parentFunction ? opts.parentFunction : null,
    isListenEditHandler: Boolean(opts && opts.isListenEditHandler),
    listenEditEventType: opts && opts.listenEditEventType ? opts.listenEditEventType : null,
    apiCategories: new Set(),
    apiNames: new Set(),
    stateReads: new Set(),
    stateWrites: new Set(),
  };
  collected.functions.push(rec);
  ensureFnIndex(rec.name).push(rec);
  fnHandled.add(nodeKey(node));
  const p = prefixOf(rec.displayName);
  if (p) {
    if (!collected.prefixBuckets.has(p)) collected.prefixBuckets.set(p, []);
    collected.prefixBuckets.get(p).push(rec);
  }
  return rec;
}

function markHandler(type, line, isAsync, fnName, detail) {
  collected.handlers.push({ type, line, isAsync: Boolean(isAsync), functionName: fnName || null, detail: detail || null });
}

function addApiCall(apiName, line, fnName) {
  const meta = RISUAI_API[apiName];
  if (!meta) return;
  collected.apiCalls.push({ apiName, category: meta.cat, access: meta.access, rw: meta.rw, line, containingFunction: fnName || "<top-level>" });
  if (!fnName) return;
  for (const f of ensureFnIndex(fnName)) {
    f.apiCategories.add(meta.cat);
    f.apiNames.add(apiName);
  }
}

function addStateAccess(apiName, key, fnName, line, writeValue) {
  if (!key) return;
  const sv = ensureStateVar(key);
  sv.apis.add(apiName);
  const rw = RISUAI_API[apiName] && RISUAI_API[apiName].rw;
  const owner = fnName || "<top-level>";
  if (rw === "read") sv.readBy.add(owner);
  if (rw === "write") {
    sv.writtenBy.add(owner);
    // Track first write value for registry suggestion
    if (sv.firstWriteValue === null && writeValue !== null && writeValue !== undefined) {
      sv.firstWriteValue = writeValue;
      sv.firstWriteFunction = owner;
      sv.firstWriteLine = line || 0;
    }
    // Detect dual-write pattern (setState + setChatVar for same key → number type)
    if (apiName === "setState" && sv.apis.has("setChatVar")) sv.hasDualWrite = true;
    if (apiName === "setChatVar" && sv.apis.has("setState")) sv.hasDualWrite = true;
  }
  if (!fnName) return;
  for (const f of ensureFnIndex(fnName)) {
    if (rw === "read") f.stateReads.add(key);
    if (rw === "write") f.stateWrites.add(key);
  }
}

function addDataTable(name, tableNode, depth) {
  if (!tableNode || tableNode.type !== "TableConstructorExpression") return;
  const fields = safeArray(tableNode.fields);
  if (fields.length < 3) return;
  collected.dataTables.push({ name: name || `table_l${lineStart(tableNode)}`, fieldCount: fields.length, startLine: lineStart(tableNode), endLine: lineEnd(tableNode), depth: depth || 0 });
}

function findAsyncFn(callNode) {
  if (!callNode || callNode.type !== "CallExpression") return null;
  if (directCalleeName(callNode) !== "async") return null;
  const args = callArgs(callNode);
  return args[0] && args[0].type === "FunctionDeclaration" ? args[0] : null;
}

function handleCallExpr(node, explicitParent) {
  const caller = currentFn(explicitParent);
  const callee = directCalleeName(node);
  if (!callee) return;
  collected.calls.push({ caller, callee, line: lineStart(node) });
  if (!RISUAI_API[callee]) return;
  addApiCall(callee, lineStart(node), caller);
  if (callee === "setChatVar" || callee === "getChatVar" || callee === "setState" || callee === "getState") {
    const key = strLit(callArgs(node)[1]);
    const writeValue = (callee === "setChatVar") ? strLit(callArgs(node)[2]) : null;
    if (key) addStateAccess(callee, key, caller, lineStart(node), writeValue);
  }
}

function walk(node, explicitParent) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const c of node) walk(c, explicitParent);
    return;
  }

  if (node.type === "FunctionDeclaration") {
    const k = nodeKey(node);
    let rec;
    if (!fnHandled.has(k)) {
      rec = registerFunction(node, exprName(node.identifier) || `anonymous_l${lineStart(node)}`, { isLocal: Boolean(node.isLocal), isAsync: false, parentFunction: currentFn(explicitParent) });
    } else {
      const fallbackName = sanitizeName(exprName(node.identifier) || `anonymous_l${lineStart(node)}`, `fn_l${lineStart(node)}`).replace(/-/g, "_");
      rec = ensureFnIndex(fallbackName)[0] || null;
    }
    const fnName = rec ? rec.name : currentFn(explicitParent);
    const declaredName = exprName(node.identifier);
    if (["onStart", "onInput", "onOutput", "onButtonClick"].includes(declaredName || "")) {
      markHandler(declaredName, lineStart(node), Boolean(rec && rec.isAsync), rec ? rec.name : null, declaredName);
    }
    fnStack.push(fnName);
    walk(node.body, fnName);
    fnStack.pop();
    return;
  }

  if (node.type === "LocalStatement" || node.type === "AssignmentStatement") {
    const isLocalAssign = node.type === "LocalStatement";
    const vars = safeArray(node.variables);
    const init = safeArray(node.init);
    for (let i = 0; i < init.length; i++) {
      const lhs = vars[i];
      const rhs = init[i];
      const targetName = assignName(lhs) || `fn_l${lineStart(rhs)}`;
      if (rhs && rhs.type === "FunctionDeclaration") {
        const rec = registerFunction(rhs, targetName, { isLocal: isLocalAssign, isAsync: false, parentFunction: currentFn(explicitParent) });
        if (["onStart", "onInput", "onOutput", "onButtonClick"].includes(targetName)) markHandler(targetName, lineStart(rhs), false, rec.name, targetName);
        fnStack.push(rec.name);
        walk(rhs.body, rec.name);
        fnStack.pop();
        continue;
      }
      const asyncFn = findAsyncFn(rhs);
      if (asyncFn) {
        const rec = registerFunction(asyncFn, targetName, { isLocal: isLocalAssign, isAsync: true, parentFunction: currentFn(explicitParent) });
        if (["onInput", "onOutput", "onButtonClick"].includes(targetName)) markHandler(targetName, lineStart(rhs), true, rec.name, targetName);
        fnStack.push(rec.name);
        walk(asyncFn.body, rec.name);
        fnStack.pop();
        continue;
      }
      if (rhs && rhs.type === "TableConstructorExpression") addDataTable(targetName, rhs, fnStack.length);
      walk(rhs, explicitParent);
    }
    for (const v of vars) walk(v, explicitParent);
    return;
  }

  if (node.type === "CallStatement") {
    const expr = node.expression;
    const callee = directCalleeName(expr);
    if (callee === "listenEdit") {
      const args = callArgs(expr);
      const eventType = strLit(args[0]) || "unknown";
      const fnArg = args[1];
      if (fnArg && fnArg.type === "FunctionDeclaration") {
        const rec = registerFunction(fnArg, `listenEdit_${eventType}_l${lineStart(fnArg)}`, { isLocal: false, isAsync: false, parentFunction: currentFn(explicitParent), isListenEditHandler: true, listenEditEventType: eventType });
        markHandler("listenEdit", lineStart(expr), false, rec.name, eventType);
        fnStack.push(rec.name);
        walk(fnArg.body, rec.name);
        fnStack.pop();
      }
    }
    walk(expr, explicitParent);
    return;
  }

  if (node.type === "CallExpression") {
    handleCallExpr(node, explicitParent);
    walk(node.base, explicitParent);
    for (const a of callArgs(node)) walk(a, explicitParent);
    return;
  }

  for (const v of Object.values(node)) {
    if (!v) continue;
    if (Array.isArray(v)) {
      for (const c of v) walk(c, explicitParent);
    } else if (typeof v === "object") walk(v, explicitParent);
  }
}

walk(body, null);


// ═══════════════════════════════════════════════════════════
// PHASE 3: ANALYZE — module grouping, call graph, state ownership
// ═══════════════════════════════════════════════════════════

function collectCommentSections() {
  const sorted = [...comments].sort((a, b) => lineStart(a) - lineStart(b));
  const out = [];
  for (let i = 0; i < sorted.length; i++) {
    const c = sorted[i];
    if (!isSectionSeparatorComment(c.value)) continue;
    let title = null;
    for (let j = i + 1; j < sorted.length; j++) {
      const n = sorted[j];
      if (lineStart(n) - lineStart(c) > 3) break;
      const t = String(n.value || "").trim();
      if (!t || isSectionSeparatorComment(t)) continue;
      title = t.replace(/^[-=\s═]+/, "").replace(/[-=\s═]+$/, "").trim();
      if (title) break;
    }
    out.push({ title: title || `섹션 L${lineStart(c)}`, line: lineStart(c), source: "comment" });
  }
  out.sort((a, b) => a.line - b.line);
  const dedup = [];
  for (const s of out) if (!dedup.length || dedup[dedup.length - 1].line !== s.line) dedup.push(s);
  return dedup;
}

function collectPrefixSections() {
  const out = [];
  for (const [prefix, list] of collected.prefixBuckets.entries()) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => a.startLine - b.startLine);
    out.push({ title: `${prefix}_*`, line: sorted[0].startLine, source: "prefix", prefix, endLineHint: sorted[sorted.length - 1].endLine });
  }
  out.sort((a, b) => a.line - b.line);
  return out;
}

function collectGapSections() {
  const sorted = [...collected.functions].sort((a, b) => a.startLine - b.startLine);
  const out = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    if (maxBlankRun(sorted[i].endLine + 1, sorted[i + 1].startLine - 1) > 3) {
      out.push({ title: `클러스터 L${sorted[i + 1].startLine}`, line: sorted[i + 1].startLine, source: "blank-gap" });
    }
  }
  return out;
}

function materializeSections(signals) {
  const sorted = [...signals].sort((a, b) => a.line - b.line);
  const out = [];
  for (let i = 0; i < sorted.length; i++) {
    out.push({ title: sorted[i].title, source: sorted[i].source, startLine: sorted[i].line, endLine: i + 1 < sorted.length ? sorted[i + 1].line - 1 : total });
  }
  return out.filter((s) => s.endLine >= s.startLine);
}

const commentSections = collectCommentSections();
const prefixSections = collectPrefixSections();
const gapSections = collectGapSections();
let signals;
const noisyCommentSections = commentSections.length > Math.max(60, Math.floor(collected.functions.length * 0.6));
if (commentSections.length && !noisyCommentSections) signals = commentSections;
else if (prefixSections.length) signals = prefixSections;
else if (gapSections.length) signals = [{ title: "전체", line: 1, source: "default" }, ...gapSections];
else signals = [{ title: "전체", line: 1, source: "default" }];
const sections = materializeSections(signals);

function buildSectionMapSections() {
  const commentMap = commentSections.length ? materializeSections(commentSections) : [];
  if (commentMap.length) {
    const minSize = Math.max(20, Math.floor(total * 0.003));
    const filtered = commentMap.filter((s) => {
      const size = s.endLine - s.startLine + 1;
      const t = String(s.title || "").trim();
      if (!t) return false;
      if (size < minSize && s.startLine > 300) return false;
      if (/^섹션\s+L\d+$/i.test(t)) return false;
      return true;
    });
    if (filtered.length) return filtered.slice(0, 40);
    return commentMap.slice(0, 40);
  }
  return sections.slice(0, 40);
}

const sectionMapSections = buildSectionMapSections();

const callGraph = new Map();
for (const fn of collected.functions) if (!callGraph.has(fn.name)) callGraph.set(fn.name, new Set());
for (const c of collected.calls) {
  if (!c.caller || !c.callee) continue;
  if (LUA_STDLIB_CALLS.has(c.callee) || RISUAI_API[c.callee]) continue;
  const normalizedCallee = sanitizeName(c.callee, c.callee).replace(/-/g, "_");
  if (!callGraph.has(c.caller)) callGraph.set(c.caller, new Set());
  callGraph.get(c.caller).add(normalizedCallee);
}

const calledBy = new Map();
for (const [caller, targets] of callGraph.entries()) {
  for (const t of targets) {
    if (!calledBy.has(t)) calledBy.set(t, new Set());
    calledBy.get(t).add(caller);
  }
}

const apiByCategory = new Map();
for (const a of collected.apiCalls) {
  if (!apiByCategory.has(a.category)) apiByCategory.set(a.category, { apis: new Set(), count: 0 });
  const row = apiByCategory.get(a.category);
  row.apis.add(a.apiName);
  row.count += 1;
}

const moduleGroups = [];
const moduleByFunction = new Map();

function createGroup(seed) {
  const g = {
    name: toModuleName(seed.name) || `module_${moduleGroups.length + 1}`,
    title: seed.title || seed.name,
    reason: seed.reason || "heuristic",
    source: seed.source || "heuristic",
    functions: new Set(),
    tables: new Set(),
    apiCats: new Set(),
    stateKeys: new Set(),
    dir: "src/modules",
  };
  moduleGroups.push(g);
  return g;
}

function addFnToGroup(group, fn) {
  if (moduleByFunction.has(fn.name)) return;
  group.functions.add(fn.name);
  moduleByFunction.set(fn.name, group.name);
  for (const c of fn.apiCategories) group.apiCats.add(c);
  for (const k of fn.stateReads) group.stateKeys.add(k);
  for (const k of fn.stateWrites) group.stateKeys.add(k);
}

// ── Containment tree ─────────────────────────────────────
const childrenOf = new Map();
const rootFunctions = [];

for (const fn of collected.functions) {
  if (fn.parentFunction && collected.functionIndexByName.has(fn.parentFunction)) {
    if (!childrenOf.has(fn.parentFunction)) childrenOf.set(fn.parentFunction, []);
    childrenOf.get(fn.parentFunction).push(fn);
  } else {
    rootFunctions.push(fn);
  }
}

function getDescendants(fnName) {
  const result = [];
  for (const child of (childrenOf.get(fnName) || [])) {
    result.push(child);
    result.push(...getDescendants(child.name));
  }
  return result;
}

function addFnTreeToGroup(group, fn) {
  addFnToGroup(group, fn);
  for (const desc of getDescendants(fn.name)) addFnToGroup(group, desc);
}


// ── Repetitive naming pattern detection ──────────────────
function detectRepetitiveGroups() {
  const patterns = new Map();
  for (const fn of rootFunctions) {
    const name = fn.displayName;
    let base = null;
    const m1 = name.match(/^(.+?)_\d+_\w+$/);
    if (m1 && m1[1].length >= 3) base = m1[1];
    if (!base) {
      const m2 = name.match(/^(.+?)\d+$/);
      if (m2 && m2[1].length >= 3) base = m2[1];
    }
    if (base) {
      if (!patterns.has(base)) patterns.set(base, []);
      patterns.get(base).push(fn);
    }
  }
  return new Map([...patterns].filter(([_, fns]) => fns.length >= 3));
}
const repetitiveGroups = detectRepetitiveGroups();

// ── Step 1: Event handler modules ────────────────────────
for (const fn of rootFunctions) {
  const isMainHandler = ["onStart", "onInput", "onOutput", "onButtonClick"].includes(fn.displayName);
  if (!isMainHandler && !fn.isListenEditHandler) continue;
  if (moduleByFunction.has(fn.name)) continue;
  const modName = fn.isListenEditHandler ? `listener_${fn.listenEditEventType || "unknown"}` : fn.displayName;
  const g = createGroup({ name: modName, title: modName, reason: "event-handler", source: "handler" });
  addFnTreeToGroup(g, fn);
}

// ── Step 2: Repetitive pattern modules ───────────────────
for (const [pattern, fns] of repetitiveGroups) {
  if (fns.every((fn) => moduleByFunction.has(fn.name))) continue;
  const g = createGroup({ name: pattern, title: `${pattern}_* (${fns.length} functions)`, reason: "repetitive-pattern", source: "pattern" });
  for (const fn of fns) if (!moduleByFunction.has(fn.name)) addFnTreeToGroup(g, fn);
}

// ── Step 2.5: Widely-called functions → shared utilities ──
const widelyUsedFns = [];
for (const fn of rootFunctions) {
  if (moduleByFunction.has(fn.name)) continue;
  if (fn.lineCount > 30) continue;
  const callerMods = new Set();
  for (const [caller, targets] of callGraph.entries()) {
    if (targets.has(fn.name) && moduleByFunction.has(caller)) {
      callerMods.add(moduleByFunction.get(caller));
    }
  }
  if (callerMods.size >= 2) widelyUsedFns.push(fn);
}
if (widelyUsedFns.length > 0) {
  const g = createGroup({ name: "shared", title: "Shared Functions", reason: "widely-used", source: "cross-module" });
  for (const fn of widelyUsedFns) addFnTreeToGroup(g, fn);
}

// ── Step 3: Agglomerative function clustering ────────────
const unassigned = rootFunctions.filter((fn) => !moduleByFunction.has(fn.name));

function pairScore(a, b) {
  let score = 0;
  const callsA = callGraph.get(a.name) || new Set();
  const callsB = callGraph.get(b.name) || new Set();
  if (callsA.has(b.name)) score += 5;
  if (callsB.has(a.name)) score += 5;
  const stateA = new Set([...a.stateReads, ...a.stateWrites]);
  const stateB = new Set([...b.stateReads, ...b.stateWrites]);
  for (const k of stateA) if (stateB.has(k)) score += 3;
  for (const t of callsA) if (callsB.has(t)) score += 1;
  const calledByA = calledBy.get(a.name) || new Set();
  const calledByB = calledBy.get(b.name) || new Set();
  for (const c of calledByA) if (calledByB.has(c)) score += 1;
  return score;
}

// Precompute pairwise scores
const pairScoreCache = new Map();
for (let i = 0; i < unassigned.length; i++) {
  for (let j = i + 1; j < unassigned.length; j++) {
    const a = unassigned[i], b = unassigned[j];
    const s = pairScore(a, b);
    if (s > 0) {
      pairScoreCache.set(`${a.name}\0${b.name}`, s);
      pairScoreCache.set(`${b.name}\0${a.name}`, s);
    }
  }
}
function getCachedScore(a, b) { return pairScoreCache.get(`${a.name}\0${b.name}`) || 0; }

// Initial clusters: one per function
let clusters = unassigned.map((fn) => ({ fns: [fn] }));

// Agglomerative merge (single linkage, max 12 functions per cluster)
while (clusters.length > 1) {
  let bestI = -1, bestJ = -1, bestMax = 0;
  for (let i = 0; i < clusters.length; i++) {
    for (let j = i + 1; j < clusters.length; j++) {
      if (clusters[i].fns.length + clusters[j].fns.length > 12) continue;
      let maxScore = 0;
      for (const a of clusters[i].fns) {
        for (const b of clusters[j].fns) {
          const s = getCachedScore(a, b);
          if (s > maxScore) maxScore = s;
        }
      }
      if (maxScore > bestMax) { bestI = i; bestJ = j; bestMax = maxScore; }
    }
  }
  if (bestMax < 6) break;
  clusters[bestI].fns.push(...clusters[bestJ].fns);
  clusters.splice(bestJ, 1);
}

// Create modules from clusters
for (const cluster of clusters) {
  if (!cluster.fns.length) continue;
  if (cluster.fns.length === 1 && cluster.fns[0].lineCount < 200) continue;
  // Pick most "central" function (most intra-cluster connections) for naming
  let bestNameFn = cluster.fns[0];
  let bestConns = -1;
  for (const fn of cluster.fns) {
    let conns = 0;
    const callees = callGraph.get(fn.name) || new Set();
    for (const callee of callees) if (cluster.fns.some(f => f.name === callee)) conns++;
    const callers = calledBy.get(fn.name) || new Set();
    for (const caller of callers) if (cluster.fns.some(f => f.name === caller)) conns++;
    if (conns > bestConns || (conns === bestConns && fn.lineCount > bestNameFn.lineCount)) {
      bestConns = conns;
      bestNameFn = fn;
    }
  }
  const g = createGroup({
    name: bestNameFn.displayName,
    title: bestNameFn.displayName,
    reason: cluster.fns.length > 1 ? "function-cluster" : "standalone-function",
    source: "function"
  });
  for (const fn of cluster.fns) addFnTreeToGroup(g, fn);
}

// 3d: Absorb remaining singletons (skip handler modules to avoid bloat)
for (const fn of rootFunctions) {
  if (moduleByFunction.has(fn.name)) continue;
  let best = null;
  let bestScore = 0;
  for (const g of moduleGroups) {
    if (g.reason === "event-handler" || g.reason === "widely-used") continue;
    let score = 0;
    const fState = new Set([...fn.stateReads, ...fn.stateWrites]);
    for (const k of fState) if (g.stateKeys.has(k)) score += 3;
    for (const t of (callGraph.get(fn.name) || [])) if (g.functions.has(t)) score += 2;
    for (const [caller, targets] of callGraph.entries()) {
      if (targets.has(fn.name) && g.functions.has(caller)) score += 2;
    }
    for (const c of fn.apiCategories) if (g.apiCats.has(c)) score += 1;
    if (score > bestScore) { best = g; bestScore = score; }
  }
  if (best && bestScore >= 3) {
    addFnTreeToGroup(best, fn);
  }
}

// ── Step 5: Remaining → utils / misc ─────────────────────
const remaining = rootFunctions.filter((fn) => !moduleByFunction.has(fn.name));
if (remaining.length > 0) {
  const utilities = remaining.filter((fn) => fn.apiNames.size === 0 && fn.stateReads.size === 0 && fn.stateWrites.size === 0);
  const misc = remaining.filter((fn) => fn.apiNames.size > 0 || fn.stateReads.size > 0 || fn.stateWrites.size > 0);
  if (utilities.length) {
    const g = createGroup({ name: "helpers", title: "Helper Utilities", reason: "pure-utility", source: "utility" });
    for (const fn of utilities) addFnTreeToGroup(g, fn);
  }
  if (misc.length) {
    const g = createGroup({ name: "misc", title: "Miscellaneous", reason: "uncategorized", source: "misc" });
    for (const fn of misc) addFnTreeToGroup(g, fn);
  }
}

// ── Step 6: Top-level data tables only ───────────────────
for (const t of collected.dataTables) {
  if (t.depth > 0) continue;
  const name = sanitizeName(t.name, `data_${moduleGroups.length + 1}`);
  let g = moduleGroups.find((x) => x.name === name);
  if (!g) g = createGroup({ name, title: t.name, reason: "data-table", source: "table" });
  g.tables.add(t.name);
}

// ── Step 7: Directory assignment ─────────────────────────
for (const g of moduleGroups) {
  const fns = [...g.functions].map((n) => (collected.functionIndexByName.get(n) || [])[0]).filter(Boolean);
  const hasListenEdit = fns.some((f) => f.isListenEditHandler);
  const isHandler = g.reason === "event-handler";
  const onlyStdlib = fns.length > 0 && fns.every((f) => f.apiNames.size === 0);
  const isPureData = g.tables.size > 0 && g.functions.size === 0;
  if (isPureData) g.dir = "src/data";
  else if (hasListenEdit || isHandler) g.dir = "src/handlers";
  else if (g.reason === "pure-utility" || onlyStdlib) g.dir = "src/utils";
  else g.dir = "src/modules";
}

// ── Dedup ────────────────────────────────────────────────
const dedupedGroups = new Map();
for (const g of moduleGroups) {
  if (!g.functions.size && !g.tables.size) continue;
  const key = `${g.dir}/${g.name}`;
  const found = dedupedGroups.get(key);
  if (!found) {
    dedupedGroups.set(key, g);
    continue;
  }
  for (const fn of g.functions) found.functions.add(fn);
  for (const tb of g.tables) found.tables.add(tb);
  for (const c of g.apiCats) found.apiCats.add(c);
  for (const k of g.stateKeys) found.stateKeys.add(k);
}
moduleGroups.length = 0;
for (const g of dedupedGroups.values()) moduleGroups.push(g);

const stateOwnership = [];
for (const [key, access] of collected.stateVars.entries()) {
  const writers = [...access.writtenBy].filter((n) => n !== "<top-level>");
  const readBy = [...access.readBy].filter((n) => n !== "<top-level>");
  const writerModuleCount = new Map();
  for (const fn of writers) {
    const mod = moduleByFunction.get(fn) || "(unassigned)";
    writerModuleCount.set(mod, (writerModuleCount.get(mod) || 0) + 1);
  }
  let ownerModule = "(none)";
  let ownerCount = -1;
  for (const [mod, count] of writerModuleCount.entries()) {
    if (count > ownerCount) {
      ownerModule = mod;
      ownerCount = count;
    }
  }
  const mods = new Set([...writers, ...readBy].map((f) => moduleByFunction.get(f) || "(unassigned)"));
  stateOwnership.push({ key, readBy, writers, ownerModule, crossModule: mods.size > 1 });
}
stateOwnership.sort((a, b) => a.key.localeCompare(b.key));

// ── Chat Variable Registry: init pattern detection ──
const registryVars = [];
for (const [key, access] of collected.stateVars.entries()) {
  // Only setChatVar-based variables (not pure setState)
  if (!access.apis.has("setChatVar") && !access.apis.has("getChatVar")) continue;
  const fn = access.firstWriteFunction;
  let isInitPattern = false;
  if (fn) {
    const lcFn = fn.toLowerCase();
    if (lcFn.includes("init") || lcFn === "onstart" || lcFn === "<top-level>") {
      isInitPattern = true;
    }
  }
  // Determine suggested type: dual-write or numeric-looking default → number
  const fwv = access.firstWriteValue;
  const looksNumeric = fwv !== null && /^-?\d+(\.\d+)?$/.test(fwv);
  const suggestNumber = access.hasDualWrite || (looksNumeric && access.apis.has("setState"));
  registryVars.push({
    key,
    suggestedDefault: fwv !== null ? fwv : "",
    suggestNumber,
    isInitPattern,
    readCount: access.readBy.size,
    writeCount: access.writtenBy.size,
    firstWriteFunction: access.firstWriteFunction || "-",
    hasDualWrite: access.hasDualWrite,
  });
}
registryVars.sort((a, b) => {
  // Init pattern first, then by key name
  if (a.isInitPattern !== b.isInitPattern) return a.isInitPattern ? -1 : 1;
  return a.key.localeCompare(b.key);
});


// ═══════════════════════════════════════════════════════════
// PHASE 4: FORMAT — console output + markdown report
// ═══════════════════════════════════════════════════════════

function bar(size) {
  const n = Math.max(1, Math.round((size / total) * 30));
  return "█".repeat(n) + "░".repeat(30 - n);
}

function printSections() {
  console.log("  ════════════════════════════════════════");
  console.log("  섹션 맵");
  console.log("  ────────────────────────────────────────");
  if (!sectionMapSections.length) {
    console.log("  (없음)");
    return;
  }
  for (const s of sectionMapSections) {
    const size = s.endLine - s.startLine + 1;
    console.log(`  ${String(s.startLine).padStart(5)}  ${bar(size)} ${s.title} (${size})`);
  }
  if (sectionMapSections.length < commentSections.length) {
    console.log(`  ... ${commentSections.length - sectionMapSections.length}개 섹션은 요약에서 생략됨`);
  }
}

function printTopFunctions() {
  const sorted = [...collected.functions].sort((a, b) => b.lineCount - a.lineCount).slice(0, 20);
  console.log("\n  ────────────────────────────────────────");
  console.log(`  거대 함수 TOP ${sorted.length}`);
  console.log("  ────────────────────────────────────────");
  for (const fn of sorted) {
    const pct = total > 0 ? ((fn.lineCount / total) * 100).toFixed(1) : "0.0";
    const warn = fn.lineCount > 500 ? " ⚠️  분할 권장" : fn.lineCount > 200 ? " ⚡" : "";
    console.log(`  ${String(fn.lineCount).padStart(5)} (${pct}%)  ${fn.isLocal ? "local " : ""}${fn.displayName}${fn.isAsync ? " async" : ""}  [${fn.startLine}~${fn.endLine}]${warn}`);
  }
}

function printHandlers() {
  console.log("\n  ────────────────────────────────────────");
  console.log("  이벤트 핸들러");
  console.log("  ────────────────────────────────────────");
  if (!collected.handlers.length) {
    console.log("  (없음)");
    return;
  }
  for (const h of collected.handlers) {
    const detail = h.type === "listenEdit" ? ` (${h.detail})` : "";
    console.log(`  L${String(h.line).padStart(5)}  👂 ${h.type}${detail} [${h.isAsync ? "async" : "sync"}]`);
  }
}

function printStateVars() {
  console.log("\n  ────────────────────────────────────────");
  console.log(`  상태 변수 (${stateOwnership.length}개)`);
  console.log("  ────────────────────────────────────────");
  if (!stateOwnership.length) {
    console.log("  (없음)");
    return;
  }
  for (const s of stateOwnership.slice(0, 30)) {
    console.log(`  💾 ${s.key}  R:${s.readBy.length} W:${s.writers.length} owner:${s.ownerModule}${s.crossModule ? " ⚠️" : ""}`);
  }
  if (stateOwnership.length > 30) console.log(`  ... +${stateOwnership.length - 30} more`);
}

function printApiUsage() {
  console.log("\n  ────────────────────────────────────────");
  console.log("  RisuAI API 사용량");
  console.log("  ────────────────────────────────────────");
  if (!apiByCategory.size) {
    console.log("  (없음)");
    return;
  }
  for (const [cat, info] of [...apiByCategory.entries()].sort((a, b) => b[1].count - a[1].count)) {
    const apis = [...info.apis].sort();
    const icon = cat === "state" ? "💾" : cat === "event" ? "👂" : cat === "ai" ? "⚡" : "📋";
    console.log(`  ${icon} ${cat.padEnd(10)} ${String(info.count).padStart(4)} calls  ${apis.slice(0, 4).join(", ")}${apis.length > 4 ? ` +${apis.length - 4}` : ""}`);
  }
}

function printModules() {
  console.log("\n  ════════════════════════════════════════");
  console.log("  📋 제안 모듈 구조");
  console.log("  ════════════════════════════════════════\n");
  const sorted = [...moduleGroups].sort((a, b) => `${a.dir}/${a.name}`.localeCompare(`${b.dir}/${b.name}`));
  const shown = sorted.slice(0, MAX_MODULES_IN_REPORT);
  for (const g of shown) {
    const icon = g.dir === "src/utils" ? "🔧" : g.dir === "src/handlers" ? "👂" : g.dir === "src/data" ? "💾" : "📦";
    const fns = [...g.functions];
    console.log(`  ${icon} ${g.dir}/${g.name}.ts${fns.length >= 12 ? " ⚠️" : ""}`);
    console.log(`     ${g.title} (${g.reason})`);
    for (const fn of fns.slice(0, 8)) {
      const rec = (collected.functionIndexByName.get(fn) || [])[0];
      if (!rec) continue;
      const nested = rec.parentFunction && moduleByFunction.get(rec.parentFunction) === moduleByFunction.get(rec.name);
      console.log(`     ${nested ? "↳" : "·"} ${rec.displayName}${rec.isAsync ? " [async]" : ""}`);
    }
    if (fns.length > 8) console.log(`     · +${fns.length - 8} more`);
    for (const t of g.tables) console.log(`     · table ${t}`);
    console.log("");
  }
  if (sorted.length > shown.length) {
    console.log(`  ... ${sorted.length - shown.length}개 모듈은 보고서 가독성을 위해 생략됨`);
    console.log("  (마크다운 파일에도 동일한 제한이 적용됩니다)");
    console.log("");
  }
}

function printRegistrySuggestion() {
  if (!registryVars.length) return;
  const MAX_CONSOLE_VARS = 20;
  console.log("\n  ════════════════════════════════════════");
  console.log(`  📋 Chat Variable Registry 제안 (${registryVars.length}개)`);
  console.log("  ────────────────────────────────────────");
  for (const v of registryVars.slice(0, MAX_CONSOLE_VARS)) {
    const type = v.suggestNumber ? "num" : "str";
    const init = v.isInitPattern ? "✓ init" : "      ";
    const dual = v.hasDualWrite ? " ↔" : "  ";
    const def = v.suggestedDefault !== "" ? v.suggestedDefault : '""';
    console.log(`  ${init}${dual} ${type.padEnd(3)} ${v.key.padEnd(30)} = ${def}  (R:${v.readCount} W:${v.writeCount})`);
  }
  if (registryVars.length > MAX_CONSOLE_VARS) {
    console.log(`  ... +${registryVars.length - MAX_CONSOLE_VARS} more (마크다운 참조)`);
  }
  console.log("");
}

function printSummary() {
  console.log("  ────────────────────────────────────────");
  console.log("  📊 요약");
  console.log(`     ${total} lines / ${collected.functions.length} functions / ${collected.handlers.length} handlers / ${collected.apiCalls.length} API calls`);
  console.log(`     500줄+ 함수: ${collected.functions.filter((f) => f.lineCount > 500).length}개 (분할 권장)`);
  console.log(`     200줄+ 함수: ${collected.functions.filter((f) => f.lineCount > 200).length}개`);
  console.log(`     상태 변수: ${stateOwnership.length}개 / 제안 모듈: ${moduleGroups.length}개`);
  console.log("");
}

printSections();
printTopFunctions();
printHandlers();
printStateVars();
printApiUsage();
printModules();
printRegistrySuggestion();
printSummary();

const moduleFilePath = (g) => `${g.dir}/${g.name}.ts`;
const moduleFns = (g) => [...g.functions].map((n) => (collected.functionIndexByName.get(n) || [])[0]).filter(Boolean).sort((a, b) => a.startLine - b.startLine);
const mdRow = (arr) => `| ${arr.join(" | ")} |`;

function dependencyEdges() {
  const edges = new Set();
  for (const [caller, targets] of callGraph.entries()) {
    const from = moduleByFunction.get(caller);
    if (!from) continue;
    for (const callee of targets) {
      const to = moduleByFunction.get(callee);
      if (to && to !== from) edges.add(`${from}-->${to}`);
    }
  }
  return [...edges];
}

// ── Module interface computation ──────────────────────────

function computeModuleExports(g) {
  const exports = new Map();
  for (const fnName of g.functions) {
    const callers = calledBy.get(fnName) || new Set();
    for (const caller of callers) {
      const callerMod = moduleByFunction.get(caller);
      if (callerMod && callerMod !== g.name) {
        if (!exports.has(fnName)) exports.set(fnName, new Set());
        exports.get(fnName).add(callerMod);
      }
    }
  }
  return exports;
}

function computeModuleImports(g) {
  const imports = new Map();
  for (const fnName of g.functions) {
    const callees = callGraph.get(fnName) || new Set();
    for (const callee of callees) {
      const calleeMod = moduleByFunction.get(callee);
      if (calleeMod && calleeMod !== g.name) {
        if (!imports.has(callee)) imports.set(callee, calleeMod);
      }
    }
  }
  return imports;
}

function computeModuleStateVars(g) {
  const vars = [];
  for (const fnName of g.functions) {
    const fnRec = (collected.functionIndexByName.get(fnName) || [])[0];
    if (!fnRec) continue;
    for (const key of fnRec.stateReads) vars.push({ key, access: "read", fn: fnName });
    for (const key of fnRec.stateWrites) vars.push({ key, access: "write", fn: fnName });
  }
  const grouped = new Map();
  for (const v of vars) {
    const k = `${v.key}:${v.access}`;
    if (!grouped.has(k)) grouped.set(k, { key: v.key, access: v.access, fns: new Set() });
    grouped.get(k).fns.add(v.fn);
  }
  return [...grouped.values()].sort((a, b) => a.key.localeCompare(b.key) || a.access.localeCompare(b.access));
}

function computeCrossModuleDeps() {
  const deps = new Map();
  for (const [caller, targets] of callGraph.entries()) {
    const fromMod = moduleByFunction.get(caller);
    if (!fromMod) continue;
    for (const callee of targets) {
      const toMod = moduleByFunction.get(callee);
      if (toMod && toMod !== fromMod) {
        const key = `${fromMod}\0${toMod}`;
        if (!deps.has(key)) deps.set(key, new Set());
        deps.get(key).add(callee);
      }
    }
  }
  return deps;
}

function computeExtractionOrder() {
  const modNames = moduleGroups.map(g => g.name);
  const modDeps = new Map();
  for (const name of modNames) modDeps.set(name, new Set());
  for (const g of moduleGroups) {
    for (const fnName of g.functions) {
      const callees = callGraph.get(fnName) || new Set();
      for (const callee of callees) {
        const calleeMod = moduleByFunction.get(callee);
        if (calleeMod && calleeMod !== g.name && modDeps.has(calleeMod)) {
          modDeps.get(g.name).add(calleeMod);
        }
      }
    }
  }
  const sorted = [];
  const remaining = new Set(modNames);
  const processed = new Set();
  while (remaining.size > 0) {
    const ready = [];
    for (const name of remaining) {
      const deps = modDeps.get(name) || new Set();
      let allDepsProcessed = true;
      for (const dep of deps) {
        if (!processed.has(dep)) { allDepsProcessed = false; break; }
      }
      if (allDepsProcessed) ready.push(name);
    }
    if (ready.length === 0) {
      sorted.push(...[...remaining].sort());
      break;
    }
    ready.sort((a, b) => {
      const ga = moduleGroups.find(g => g.name === a);
      const gb = moduleGroups.find(g => g.name === b);
      return (ga ? ga.functions.size : 0) - (gb ? gb.functions.size : 0);
    });
    for (const name of ready) {
      sorted.push(name);
      remaining.delete(name);
      processed.add(name);
    }
  }
  return sorted;
}

function renderMarkdown() {
  const filename = path.basename(filePath);
  const crossDeps = computeCrossModuleDeps();
  const extractionOrder = computeExtractionOrder();
  const modByName = new Map(moduleGroups.map(g => [g.name, g]));

  const out = [];

  out.push(`# ${filename} — Modularization Blueprint`);
  out.push("");
  out.push("> Auto-generated static analysis for AI-driven modularization.");
  out.push("> Source file is a monolithic Lua script for RisuAI character bundling.");
  out.push("> Use this document to extract functions into TypeScript modules.");
  out.push("");

  // ── Source Info ──
  out.push("## Source Info");
  out.push("| Metric | Value |");
  out.push("|--------|-------|");
  out.push(mdRow(["File", filename]));
  out.push(mdRow(["Total Lines", String(total)]));
  out.push(mdRow(["Functions (total)", String(collected.functions.length)]));
  out.push(mdRow(["Root Functions", String(rootFunctions.length)]));
  out.push(mdRow(["Event Handlers", String(collected.handlers.length)]));
  out.push(mdRow(["State Variables", String(stateOwnership.length)]));
  out.push(mdRow(["Suggested Modules", String(moduleGroups.length)]));
  out.push("");

  // ── Extraction Order ──
  out.push("## Extraction Order");
  out.push("");
  out.push("Extract modules in this order. Modules with no dependencies come first.");
  out.push("");
  out.push("| # | Module | Dependencies | Functions | Reason |");
  out.push("|---|--------|--------------|-----------|--------|");
  for (let i = 0; i < extractionOrder.length; i++) {
    const name = extractionOrder[i];
    const g = modByName.get(name);
    if (!g) continue;
    const deps = new Set();
    for (const fnName of g.functions) {
      const callees = callGraph.get(fnName) || new Set();
      for (const callee of callees) {
        const calleeMod = moduleByFunction.get(callee);
        if (calleeMod && calleeMod !== g.name) deps.add(calleeMod);
      }
    }
    const depStr = deps.size > 0 ? [...deps].sort().join(", ") : "(none)";
    out.push(mdRow([String(i + 1), `\`${moduleFilePath(g)}\``, depStr, String(g.functions.size), g.reason]));
  }
  out.push("");

  // ── Module Specifications ──
  out.push("## Module Specifications");
  out.push("");

  for (const name of extractionOrder) {
    const g = modByName.get(name);
    if (!g) continue;
    const fns = moduleFns(g);
    const modExports = computeModuleExports(g);
    const modImports = computeModuleImports(g);
    const modStateVars = computeModuleStateVars(g);

    out.push(`### \`${moduleFilePath(g)}\``);
    out.push(`- **Reason**: ${g.reason}`);
    if (fns.length > 0) {
      const minLine = Math.min(...fns.map(f => f.startLine));
      const maxLine = Math.max(...fns.map(f => f.endLine));
      out.push(`- **Source Range**: L${minLine}–L${maxLine}`);
    }
    out.push("");

    // Functions table
    out.push("#### Functions");
    out.push("| Function | Lines | Params | Nested In |");
    out.push("|----------|-------|--------|-----------|");
    for (const fn of fns) {
      const isNested = fn.parentFunction && moduleByFunction.get(fn.parentFunction) === moduleByFunction.get(fn.name);
      const indent = isNested ? "↳ " : "";
      const params = fn.params.length > 0 ? fn.params.join(", ") : "-";
      const parent = isNested ? fn.parentFunction : "-";
      const asyncTag = fn.isAsync ? " (async)" : "";
      out.push(mdRow([
        indent + fn.displayName + asyncTag,
        `L${fn.startLine}–L${fn.endLine} (${fn.lineCount})`,
        params,
        parent
      ]));
    }
    if (fns.length === 0 && g.tables.size > 0) {
      out.push(mdRow([`(data) ${[...g.tables].join(", ")}`, "-", "-", "-"]));
    }
    out.push("");

    // Exports
    if (modExports.size > 0) {
      out.push("#### Exports");
      out.push("| Function | Called By Modules |");
      out.push("|----------|------------------|");
      for (const [fnName, mods] of [...modExports].sort((a, b) => a[0].localeCompare(b[0]))) {
        out.push(mdRow([fnName, [...mods].sort().join(", ")]));
      }
      out.push("");
    }

    // Imports
    if (modImports.size > 0) {
      out.push("#### Imports");
      out.push("| Function | From Module |");
      out.push("|----------|-------------|");
      const byModule = new Map();
      for (const [fnName, mod] of modImports) {
        if (!byModule.has(mod)) byModule.set(mod, []);
        byModule.get(mod).push(fnName);
      }
      for (const [mod, importFns] of [...byModule].sort((a, b) => a[0].localeCompare(b[0]))) {
        for (const fn of importFns.sort()) {
          out.push(mdRow([fn, mod]));
        }
      }
      out.push("");
    }

    // State Variables
    if (modStateVars.length > 0) {
      out.push("#### State Variables");
      out.push("| Variable | Access | By Functions |");
      out.push("|----------|--------|--------------|");
      for (const sv of modStateVars) {
        out.push(mdRow([sv.key, sv.access, [...sv.fns].sort().join(", ")]));
      }
      out.push("");
    }

    out.push("---");
    out.push("");
  }

  // ── Cross-Module Dependencies ──
  out.push("## Cross-Module Dependencies");
  out.push("| From | To | Via Functions |");
  out.push("|------|-----|---------------|");
  const depEntries = [...crossDeps.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [key, fns] of depEntries) {
    const [from, to] = key.split("\0");
    out.push(mdRow([from, to, [...fns].sort().join(", ")]));
  }
  if (!depEntries.length) out.push(mdRow(["-", "-", "-"]));
  out.push("");

  // ── State Variable Ownership ──
  out.push("## State Variable Ownership");
  out.push("| Variable | Owner Module | Read By | Written By | Cross-Module |");
  out.push("|----------|-------------|---------|------------|--------------|");
  for (const s of stateOwnership) {
    out.push(mdRow([
      s.key,
      s.ownerModule,
      s.readBy.join(", ") || "-",
      s.writers.join(", ") || "-",
      s.crossModule ? "Yes" : "No"
    ]));
  }
  if (!stateOwnership.length) out.push(mdRow(["-", "-", "-", "-", "-"]));
  out.push("");

  // ── Event Handlers ──
  out.push("## Event Handlers");
  out.push("| Handler | Type | Line | Async | Module |");
  out.push("|---------|------|------|-------|--------|");
  for (const h of collected.handlers) {
    const mod = h.functionName ? (moduleByFunction.get(h.functionName) || "-") : "-";
    out.push(mdRow([
      h.functionName || "-",
      h.type === "listenEdit" ? `listenEdit(${h.detail})` : h.type,
      `L${h.line}`,
      h.isAsync ? "Yes" : "No",
      mod
    ]));
  }
  if (!collected.handlers.length) out.push(mdRow(["-", "-", "-", "-", "-"]));
  out.push("");

  // ── RisuAI API Usage ──
  out.push("## RisuAI API Usage");
  out.push("| Category | APIs | Count |");
  out.push("|----------|------|-------|");
  const apiRows = [...apiByCategory.entries()].sort((a, b) => b[1].count - a[1].count);
  for (const [cat, info] of apiRows) out.push(mdRow([cat, [...info.apis].sort().join(", "), String(info.count)]));
  if (!apiRows.length) out.push(mdRow(["-", "-", "0"]));
  out.push("");

  // ── Chat Variable Registry Suggestion ──
  if (registryVars.length > 0) {
    const MAX_REG_VARS = 80;
    out.push("## Chat Variable Registry (Suggested)");
    out.push("");
    out.push("> 정적 분석으로 감지된 채팅 변수들입니다.");
    out.push("> `createRegistry()` 스키마의 시작점으로 활용하세요.");
    out.push("");

    // ── Variables table ──
    out.push("### Detected Variables");
    out.push("| Variable | Type | Default | Init | Reads | Writes | First Writer | Dual-Write |");
    out.push("|----------|------|---------|:----:|:-----:|:------:|-------------|:----------:|");
    const shownVars = registryVars.slice(0, MAX_REG_VARS);
    for (const v of shownVars) {
      const type = v.suggestNumber ? "number" : "string";
      const def = v.suggestedDefault !== "" ? `\`${v.suggestedDefault}\`` : '`""`';
      const init = v.isInitPattern ? "✓" : "-";
      const dual = v.hasDualWrite ? "✓" : "-";
      out.push(mdRow([v.key, type, def, init, String(v.readCount), String(v.writeCount), v.firstWriteFunction, dual]));
    }
    if (registryVars.length > MAX_REG_VARS) {
      out.push(`\n> ... +${registryVars.length - MAX_REG_VARS}개 변수는 요약에서 생략됨`);
    }
    out.push("");

    // ── Suggested schema code block ──
    out.push("### Suggested Schema");
    out.push("");
    out.push("```typescript");
    out.push('import { createRegistry } from "./utils/chatvar-registry";');
    out.push("");
    out.push("export const vars = createRegistry({");

    const initVars = shownVars.filter(v => v.isInitPattern);
    const syncVars = shownVars.filter(v => !v.isInitPattern && v.hasDualWrite);
    const runtimeVars = shownVars.filter(v => !v.isInitPattern && !v.hasDualWrite);

    function emitVarLine(v, isLast) {
      const val = v.suggestNumber ? (Number(v.suggestedDefault) || 0) : JSON.stringify(v.suggestedDefault || "");
      const comma = isLast ? "" : ",";
      out.push(`  ${JSON.stringify(v.key)}: { default: ${val} }${comma}`);
    }

    if (initVars.length) {
      out.push("  // ── Initialized Variables ──");
      for (let i = 0; i < initVars.length; i++) {
        const isLast = !syncVars.length && !runtimeVars.length && i === initVars.length - 1;
        emitVarLine(initVars[i], isLast);
      }
    }
    if (syncVars.length) {
      if (initVars.length) out.push("");
      out.push("  // ── State-synced Variables (number) ──");
      for (let i = 0; i < syncVars.length; i++) {
        const isLast = !runtimeVars.length && i === syncVars.length - 1;
        emitVarLine(syncVars[i], isLast);
      }
    }
    if (runtimeVars.length) {
      if (initVars.length || syncVars.length) out.push("");
      out.push("  // ── Runtime Variables ──");
      for (let i = 0; i < runtimeVars.length; i++) {
        emitVarLine(runtimeVars[i], i === runtimeVars.length - 1);
      }
    }

    out.push("});");
    out.push("```");
    out.push("");

    // ── Warnings ──
    const warnings = [];
    for (const v of shownVars) {
      if (v.writeCount > 0 && v.readCount === 0) {
        warnings.push(`⚠️ \`${v.key}\`: 쓰기만 발생 (${v.writeCount}회) — CBS 템플릿 전용 변수이거나 사용되지 않는 변수일 수 있음`);
      }
      if (!v.isInitPattern && v.writeCount > 3) {
        warnings.push(`💡 \`${v.key}\`: 초기화 패턴 미감지 — nil-check 없이 ${v.writeCount}회 쓰기 발생. 레지스트리에 초기값 등록 권장`);
      }
    }
    if (warnings.length) {
      out.push("### Warnings");
      out.push("");
      for (const w of warnings.slice(0, 20)) out.push(`- ${w}`);
      if (warnings.length > 20) out.push(`- ... +${warnings.length - 20}개`);
      out.push("");
    }
  }

  return out.join("\n");
}

if (markdownMode) {
  const parsed = path.parse(filePath);
  const outPath = path.join(parsed.dir, `${parsed.name}.analysis.md`);
  fs.writeFileSync(outPath, renderMarkdown(), "utf-8");
  console.log(`  📄 Markdown report written: ${outPath}`);
}
