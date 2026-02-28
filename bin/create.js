#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const name = process.argv[2];

if (!name || name === "-h" || name === "--help") {
  console.log(`
  🐿️ risu-char-bundler

  Usage:  npx risu-char-bundler <project-name>

  RisuAI 캐릭터 모듈을 TypeScript로 개발하기 위한 TSTL 프로젝트를 생성합니다.

  포함:
    AGENT.md              AI 코딩 에이전트용 프로젝트 가이드
    scripts/analyze.js    기존 Lua 파일 분석 → 모듈 분리 제안
    scripts/extract.js    캐릭터 카드(.charx/.png) → 컴포넌트 추출
    types/risuai-lua.d.ts RisuAI Lua API 타입 선언
    src/                  바로 빌드 가능한 최소 템플릿
  process.exit(0);
}

const dest = path.resolve(name);
const templateDir = path.join(__dirname, "..", "template");

if (fs.existsSync(dest)) {
  console.error(`\n  ❌ "${name}" 디렉토리가 이미 존재합니다.\n`);
  process.exit(1);
}

// Recursive copy
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, dstPath);
    } else {
      // Binary files: copy as-is
      const BINARY_EXTS = new Set([".bin", ".png", ".jpg", ".wasm"]);
      const ext = path.extname(entry.name).toLowerCase();
      if (BINARY_EXTS.has(ext)) {
        fs.copyFileSync(srcPath, dstPath);
      } else {
        let content = fs.readFileSync(srcPath, "utf-8");
        // Replace placeholder in package.json
        if (entry.name === "package.json") {
          content = content.replace(/\{\{PROJECT_NAME\}\}/g, name);
        }
        fs.writeFileSync(dstPath, content);
      }
  }
}

copyDir(templateDir, dest);

console.log(`
  🐿️ ${name} 생성 완료!

  cd ${name}
  npm install
  npm run build        → dist/bundle.lua 생성
  npm run watch        → 파일 변경 시 자동 빌드

  캐릭터 카드 추출:
  npm run extract -- mychar.charx

  기존 Lua 파일 분석:
  npm run analyze -- your-script.lua

  AI 에이전트 사용 시:
  AGENT.md를 컨텍스트에 포함하세요.
`);
