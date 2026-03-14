#!/usr/bin/env node
// @ts-check
const path = require("path");
const { execSync } = require("child_process");

const COMMANDS = {
  extract: "extract.js",
  pack: "pack.js",
  analyze: "analyze.js",
  "analyze-card": "analyze-card.js",
  build: "build-components.js",
};

const argv = process.argv.slice(2);
const subcommand = argv[0];
const rest = argv.slice(1);

if (!subcommand || subcommand === "-h" || subcommand === "--help") {
  const cmds = Object.keys(COMMANDS).join(", ");
  console.log(`
  🐿️ risu-core CLI

  Usage:  risu-core <command> [options]

  Commands:
    extract        캐릭터 카드 추출 (.charx / .png)
    pack           캐릭터 카드 패킹
    analyze        Lua 스크립트 분석
    analyze-card   카드 종합 분석
    build          컴포넌트 빌드

  Options:
    -h, --help     도움말

  Run 'risu-core <command> --help' for command-specific help.
`);
  process.exit(0);
}

const scriptFile = COMMANDS[subcommand];
if (!scriptFile) {
  console.error(`\n  ❌ Unknown command: ${subcommand}`);
  console.error(`  Available commands: ${Object.keys(COMMANDS).join(", ")}\n`);
  process.exit(1);
}

const scriptPath = path.join(__dirname, "..", "scripts", scriptFile);

try {
  const args = rest.map((a) => `"${a}"`).join(" ");
  execSync(`node "${scriptPath}" ${args}`, {
    stdio: "inherit",
    timeout: 120000,
  });
} catch (e) {
  // execSync already printed stderr via stdio: "inherit"
  process.exit(e.status || 1);
}
