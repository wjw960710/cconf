scripts 目錄
===

> 查看或修改 `scripts/` 內任一腳本前，請先閱讀本檔案以快速定位目標腳本；需要更深入的說明則查看該腳本同名的 `.md` 檔。

本目錄收錄專案的 TypeScript 腳本，依用途分三層：

- `cli/` — `ccf` CLI 各子指令的實作。
- `extensions/` — `extensions/` 下 Chrome extension 的開發輔助腳本（icon 產生等）。
- `lib/` — 跨腳本共用的工具（env 載入、log、exit code 常數），與 `cli/`、`extensions/` 同層。

## cli/

- [`cli/build-all.ts`](./cli/build-all.md) — 並行執行所有 build 腳本（目前涵蓋 `build-claude` 與 `build-scripts`）。
- [`cli/build-claude.ts`](./cli/build-claude.md) — 合併 `plugins/common` 與各 plugin 配置，輸出到各專案 `.claude/`。
- [`cli/build-scripts.ts`](./cli/build-scripts.md) — 以 rolldown 編譯 plugin scripts 並部署至 `~/.ccf/<plugin>-scripts/`。
- [`cli/claude-cli.ts`](./cli/claude-cli.md) — 於指定專案目錄喚醒 `claude` CLI；`update` 子命令會升級 Claude Code 本體。
- [`cli/claude-desktop.ts`](./cli/claude-desktop.md) — 啟動 Claude Desktop 桌面應用（Windows）。
- [`cli/git-pull.ts`](./cli/git-pull.md) — 以 token 認證 pull 本專案，回報是否有 scripts 變動（透過 exit code）。
- [`cli/update.ts`](./cli/update.md) — `ccf update` 主流程：git-pull → deps → deploy。
- [`cli/open.ts`](./cli/open.md) — 以指定編輯器開啟專案目錄，支援多 editor fallback。
- [`cli/project-dir-path.ts`](./cli/project-dir-path.md) — 解析 `<PROJECT>_DIR_PATH` 並輸出實際路徑（可合併子路徑），給 shell 用作 `cd (ccf pdp …)` 的參數來源。
- [`cli/serve.ts`](./cli/serve.md) — 以 `node:http` 啟動最小靜態檔案 server，支援 `[dir]` / `--port` / `--host`；預設 port 取自 `CLI_SERVE_PORT`（fallback `11737`），占用時自動 `+1` 回退。

## extensions/

- [`extensions/build-icons.ts`](./extensions/build-icons.md) — 掃描 `extensions/*/source.svg`，透過 sharp 渲染為 16/32/48/128 PNG 寫入該 extension 的 `icons/`。

## lib/

- [`lib/env.js`](./lib/env.md) — `.env*` 多層載入封裝（`loadEnv({ prefix?, mode? })`，mode 啟用 4 層 Vite/Next 慣例；全鏈路只讀取一次）。
- [`lib/exit-codes.ts`](./lib/exit-codes.md) — `scripts/` 之間共用的 exit code 常數定義。
- [`lib/log.js`](./lib/log.md) — 統一 `[prefix] xxx` 診斷訊息格式（`createLogger(prefix)` 回傳 `{ log, error, warn, info }`）。
- [`lib/paths.js`](./lib/paths.md) — 共用路徑常數（`PROJECT_ROOT`），取代各腳本各自重複的 `fileURLToPath(import.meta.url)` 推導。
