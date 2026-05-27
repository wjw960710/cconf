open.ts
===

以指定編輯器開啟某個專案目錄，對應 `ccf open` 與 alias `ccf o`。

- 參數：
  - 第一個非 `-` 參數為「專案 prefix」（小寫前綴匹配 `<PROJECT>_DIR_PATH`），為空或為 `ai` 代表本專案。
  - `--new` / `-n` → 嘗試以新視窗開啟（目前僅 VS Code `code -n` 支援；其他編輯器會印出提示）。
- 目錄解析：
  - 比對到唯一 `<PROJECT>_DIR_PATH` 才繼續；多筆 / 零筆匹配或目錄不存在皆報錯退出。
  - 編輯器優先序：`<PROJECT>_OPEN_EDITOR` > `OPEN_EDITOR` > 預設 `webstorm>idea>code`，以 `>` 分隔依序嘗試。
- 編輯器探測：透過 `where`（Windows）/ `which` 確認指令存在；找到後以 `spawn(..., { detached: true }).unref()` 啟動並退出。
- 都找不到則印出嘗試過的清單後以 exit 1 結束。
