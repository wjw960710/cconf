lib/env.js
===

統一封裝 `.env` / `.env.local` 的讀取邏輯，供 `scripts/` 與 plugin scripts 共用。

- 匯出函式 `loadEnv(logPrefix?: string): void`：載入專案根目錄的 `.env` 與 `.env.local`（後者覆蓋前者）。
- 可選 `logPrefix` 用於載入時的日誌前綴（例：`[build-claude]`），方便辨識是哪個腳本觸發。
- 以 `.js` 形式存放是為了讓編譯後（rolldown）與直接 tsx 執行的腳本都能用同一份檔案 import；型別由 `env.d.ts` 提供。
