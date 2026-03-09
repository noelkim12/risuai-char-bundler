# risu-workbench

RisuAI character card tooling monorepo for core processing logic and a future VS Code workbench extension.

## Current Direction

- `template/`-based scaffolding is retired.
- This repository is the product workspace.
- Focus is on `packages/core` + `packages/vscode` + future webview package architecture.

## Repository Layout

- `packages/core/` - core engine package (card processing, analysis utilities)
- `packages/vscode/` - VS Code extension package scaffold
- `ui-mockup/` - UI prototype assets planned for webview package migration
- `docs/` - architecture, product, and research documents
- `TODO.md` - active task list (done + remaining)
- `AGENTS.md` - agent workflow rules for this repository

## Local Development

```bash
npm install
npm run --workspace packages/core build
npm run --workspace packages/core test
npm run --workspace packages/vscode build
```

## Notes

- The old `npx risu-char-bundler <project-name>` scaffold flow is no longer supported.
- Workspace architecture and extension-first structure are tracked in `TODO.md` under `#### VSCode Extension Architecture`.

## License

MIT
