lib/env.js
===

統一封裝 `.env*` 系列檔案的讀取邏輯，供 `scripts/` 與 plugin scripts 共用。

- 匯出函式 `loadEnv(options?: LoadEnvOptions): void`，型別於 `env.d.ts` 定義。
- `options.prefix?: string` — 載入時的日誌前綴（例：`build-claude`），未提供則靜默載入。
- `options.mode?: string` — 模式名稱（例：`development` / `production` / `test`）。

## 載入優先序

採用 Vite / Next.js / CRA 共通慣例，後讀者**不會**覆蓋先讀者，故由「優先序高 → 低」依序讀取：

| `mode` 是否提供 | 載入順序（高 → 低）                                                       |
| --------------- | ------------------------------------------------------------------------- |
| 未提供          | `.env.local` → `.env`                                                     |
| 已提供          | `.env.local` → `.env.[mode].local` → `.env.[mode]` → `.env`               |

| 檔名                 | 用途                       | Git      |
| -------------------- | -------------------------- | -------- |
| `.env.local`         | 本地敏感配置（密鑰等）     | gitignore |
| `.env.[mode].local`  | 本地 + 特定環境敏感        | gitignore |
| `.env.[mode]`        | 特定環境不敏感配置         | 進 git    |
| `.env`               | 全環境共用預設值           | 進 git    |

## 全鏈路只跡一次（sentinel）

為避免 `cc.mjs → spawn → 子腳本` 鏈路上每層都重做檔案 I/O 與日誌，本模組使用環境變數 `AI_CONF_ENV_LOADED` 作為 sentinel：

- 進入 `loadEnv` 時若 `process.env.AI_CONF_ENV_LOADED === '1'`，印一行 `[<prefix>] env already loaded, skip` 後 early return；無 prefix 則靜默 return。
- 首次掃描完成（不論是否實際讀到檔）後設定 `AI_CONF_ENV_LOADED=1`。
- 子進程透過 OS 層級的 env 繼承自動拿到 sentinel 與已載入的變數值，因此呼叫 `loadEnv` 時不會重複讀檔，`process.env.XXX` 本來就是 parent 載入後的狀態。
- 直接以 `tsx scripts/<x>.ts` 啟動的子腳本（無父層）sentinel 未設，正常完整載入。

注意：sentinel 只記「是否載入過」、不記用哪個 `mode`；命中時 `mode` 參數會被忽略。

## 備註

- `mode` 由呼叫端傳入，本模組不自動讀取 `NODE_ENV`；test 模式亦不自動跳過 `*.local`。
- 以 `.js` 形式存放是為了讓編譯後（rolldown）與直接 tsx 執行的腳本都能用同一份檔案 import；型別由 `env.d.ts` 提供，並以 JSDoc `import('./env.js').LoadEnvOptions` 連結回 `.js`。
