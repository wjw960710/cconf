lib/log.js
===

統一 `bin/ccf.mjs` 與 `scripts/` 下診斷訊息的 `[prefix] xxx` 輸出格式。

- 匯出函式 `createLogger(prefix: string): Logger`，型別於 `log.d.ts` 定義。
- 回傳的 `Logger` 物件含 `log` / `error` / `warn` / `info` 四個方法，分別委派到 `console.log` / `console.error` / `console.warn` / `console.info`，並將 `[${prefix}]` 作為第一個參數插入呼叫端的 args 之前。

## 使用方式

```ts
import { createLogger } from './lib/log.js'

const log = createLogger('build-claude')

log.log(`done (${written} file(s))`)        // → [build-claude] done (3 file(s))
log.error(`${envKey} is empty`)              // stderr: [build-claude] PLAYER_DIR_PATH is empty
log.warn({ foo: 1 })                         // → [build-claude] { foo: 1 }（保留 console 對物件的格式化）
```

## 適用範圍

採用 logger 的目標是「診斷訊息」——亦即原本就以 `[prefix] xxx` 格式輸出、提示腳本狀態或錯誤的訊息。

以下情境**不**應走 logger，請維持 raw `console.log` / `console.error`：

- 會被 shell capture 的純輸出（例如 `ccf pdp` 的目標路徑、`navigate-nav` 的 JSON 結果）。
- 使用者面向的結構化輸出（例如 `check-app-version` 的 `== env ==` / `url: …` / `version: …`、`ccf` 的 help 列表、各腳本 `usage()` 的多行說明）。

判斷準則：原本就**沒**帶 `[prefix]` 的 `console.log/error` 通常就是純輸出，維持原樣即可。

## 備註

- 以 `.js` 形式存放是為了讓 tsx 直接執行與 rolldown 編譯後的 plugin scripts 都能 import 同一份檔案；型別由 `log.d.ts` 提供。
- 內部刻意不做字串拼接（不寫 `console.log(\`${tag} ${msg}\`)`），保留 `console.<level>(tag, ...args)` 對物件 / 多參數的格式化能力。
- 若日後要加上時間戳、色彩、verbose 過濾，只需在此一處擴充。
