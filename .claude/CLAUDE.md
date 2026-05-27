專案資訊
===

本專案為 Claude Code 的 AI 配置中心，集中管理多個子專案的 plugin、command、skill、hook 等配置，並透過 `ccf` CLI 部署到各專案。

## 通用規則

- 腳本默認使用 Typescript 撰寫
- 腳本默認使用 tsx 執行

## 專案使用的技術

- NodeJS 版本: >=20
- 包管理: pnpm
- 程式語言: Typescript

## 重要的目錄與檔案結構

- `bin/` — CLI 入口（`ccf.mjs`），對應 `package.json` 的 bin 設定，供全局 `pnpm run link` 後使用。
- `scripts/` — TypeScript 腳本，提供 `ccf` 各子指令的實作。
  - 查看 / 修改本目錄下任一腳本前，先讀 `scripts/CATALOG.md`（總覽索引）快速定位；需要詳細說明再讀該腳本的同名 `.md`（例：`build-claude.ts` ↔ `build-claude.md`，`lib/env.js` ↔ `lib/env.md`）。
  - **同步規則**：每個 `.ts` / `.js` 都對應一份同名 `.md`（型別宣告檔 `*.d.ts` 除外）。新增 / 重命名 / 刪除腳本時，必須同步建立 / 改名 / 刪除對應的 `.md` 並更新 `CATALOG.md`；修改腳本邏輯時也需同步更新對應 `.md`，確保描述與實作一致。
- `plugins/` — Claude Code plugin 來源，依專案分組（`common`、`project`、...）
  - `scripts/` — plugin 專屬腳本一律使用 ts 寫在該目錄
- `.env*` — 環境變數設定
- `README.md` — 用戶的使用說明

## AI 讀取專案 env 規則

AI 若需要讀取本專案的環境變數，一律讀取以下兩個檔案，並以 `.env` 為基底、`.env.development.local` 覆蓋之：

1. `.env` — 基底設定（共用、可進版控）
2. `.env.development.local` — 本機開發覆蓋（不進版控，優先級高於 `.env`）

## ccf scripts 及 Plugin scripts package 安裝規則

- 統一在跟目錄使用 `pnpm` 進行安裝，不用到 plugin 目錄下安裝
- 安裝的 package 採越現代越輕量為原則，若選擇不了可以提供候選的 package 名與簡短說明還有優劣分析讓用戶選擇

## 腳本跨平台撰寫原則（macOS / Linux / Windows）

`scripts/` 與 `plugins/*/scripts/` 下所有腳本須同時支援 macOS、Linux、Windows。撰寫 / 修改腳本時遵守下列原則：

- **路徑組合**：一律使用 `node:path` 的 `join` / `resolve` / `relative`，禁止手動拼接 `/` 或 `\\`。若需把路徑當字串輸出（例如寫進 markdown / log），先以 `.replace(/\\/g, '/')` 正規化為 forward slash。
- **使用者家目錄 / 暫存目錄**：用 `os.homedir()`、`os.tmpdir()`，禁止寫死 `~`、`$HOME`、`/tmp`、`C:\Users\...`。
- **執行可執行檔**：用 `spawn` / `spawnSync` 時，若 cmd 是 `.cmd` / `.bat` / `.ps1`（pnpm、npx、tsx 等套件 bin）必須帶 `shell: process.platform === 'win32'`（或常數 `isWindows`），否則 Windows 會找不到 `.cmd` 變體。
- **平台專屬指令**：`which` ↔ `where`、`open` ↔ `start`、`rm -rf` 等需用 `process.platform` 分支，或改用 Node API（如 `fs.rm({ recursive: true, force: true })`）。
- **symlink 類型**：`fs.symlink(..., type)` 的 type 在 Windows 上資料夾需用 `'junction'`，其他平台用 `'dir'`；統一寫 `process.platform === 'win32' ? 'junction' : 'dir'`。
- **child_process 輸出換行**：解析 stdout 時用 `split(/\r?\n/)`，不要寫 `split('\n')`（Windows 上 git / pnpm 等工具輸出常含 `\r\n`）。
- **child_process 編碼**：呼叫 `execSync` / `spawnSync` 處理文字輸出時，明確帶 `encoding: 'utf8'`，避免 Windows 預設 CP950 / GBK 造成亂碼。
- **寫檔 EOL**：寫入既有檔案時，盡量保留原檔 EOL（讀取後用 `text.includes('\r\n') ? '\r\n' : '\n'` 偵測）。除非該專案明確規範固定 EOL，否則不要硬寫 `\r\n` 或 `\n`。
- **檔案權限 / chmod**：Windows 不支援 POSIX 權限位，`chmod 0o755` 之類呼叫應只在 `process.platform !== 'win32'` 時執行。
- **shebang**：本專案腳本一律以 `tsx` / `node` 顯式執行，不依賴 shebang。

## Plugin scripts 取得專案根目錄

plugin 內 `scripts/` 中的 ts 腳本若需要取得「執行該腳本的目標專案」根目錄，一律以下列方式取得，不要直接使用 `process.cwd()` 或 `__dirname` 推算：

```ts
const PROJECT_ROOT = process.env.CLAUDE_PROJECT_DIR ?? process.cwd()
```

- 優先使用 Claude Code 注入的 `CLAUDE_PROJECT_DIR` 環境變數，確保拿到的是使用者實際操作的專案目錄。
- 找不到時才 fallback 到 `process.cwd()`。
- 所有需要解析專案內檔案路徑（如 `src/...`、`config/...`）的腳本，都以此 `PROJECT_ROOT` 為基準用 `path.resolve` 組合。

## 用戶提示詞慣例

- **「查看專案 `<project_name>`」**：當用戶提示詞中出現此語句時，需同時查看以下兩處：
  1. `.env.development.local` 中 `<PROJECT_NAME>_DIR_PATH` 對應的實際專案目錄（`<PROJECT_NAME>` 為 `<project_name>` 的大寫）。
  2. 本專案 `plugins/<project_name>/` 下的 AI 配置檔（plugin、command、skill、hook 等）。

## Plugin 內部與跨 plugin 引用規則

撰寫 plugin 內的 `SKILL.md`、`command`、`hook` 等文件需要引用其他資源時，一律遵守以下路徑慣例（不要使用相對路徑或硬編碼絕對路徑）：

- **引用「自身 plugin」的其他目錄 / 檔案**：使用 `CLAUDE_PLUGIN_ROOT/<dir_name>/**/*`
  - 範例：`CLAUDE_PLUGIN_ROOT/skills/api-create/SKILL.md`
- **引用「其他 plugin」的目錄 / 檔案**：使用 `CLAUDE_PLUGIN_ROOT/../<plugin_name>/**/*`
  - 範例：`CLAUDE_PLUGIN_ROOT/../common/skills/xxx/SKILL.md`
- **調用某 plugin 部署後的 scripts**：使用 `node ~/.ccf/<plugin_name>-scripts/**/*.js`
  - 範例：`node ~/.ccf/common-scripts/api-doc/cli.js`
  - 說明：plugin 內 `scripts/` 目錄會在部署後被放到使用者家目錄 `~/.ccf/<plugin_name>-scripts/`，故統一以此路徑調用。