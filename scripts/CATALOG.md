scripts 目錄
===

> 查看或修改 `scripts/` 內任一腳本前，請先閱讀本檔案以快速定位目標腳本；需要更深入的說明則查看該腳本同名的 `.md` 檔。

本目錄收錄 `cc` CLI 各子指令的 TypeScript 實作。以下為每個腳本檔的功能簡述：

- [`build-all.ts`](./build-all.md) — 並行執行所有 build 腳本（目前涵蓋 `build-claude` 與 `build-scripts`）。
- [`build-claude.ts`](./build-claude.md) — 合併 `plugins/common` 與各 plugin 配置，輸出到各專案 `.claude/`。
- [`build-scripts.ts`](./build-scripts.md) — 以 rolldown 編譯 plugin scripts 並部署至 `~/.cconf/<plugin>-scripts/`。
- [`claude.ts`](./claude.md) — 於指定專案目錄喚醒 `claude` CLI；`update` 子命令會升級 Claude Code 本體。
- [`git-pull.ts`](./git-pull.md) — 以 token 認證 pull 本專案，回報是否有 scripts 變動（透過 exit code）。
- [`update.ts`](./update.md) — `cc update` 主流程：git-pull → deps → deploy。
- [`open.ts`](./open.md) — 以指定編輯器開啟專案目錄，支援多 editor fallback。
- [`lib/env.js`](./lib/env.md) — `.env` / `.env.local` 載入封裝（`loadEnv(prefix?)`）。
- [`lib/exit-codes.ts`](./lib/exit-codes.md) — `scripts/` 之間共用的 exit code 常數定義。
