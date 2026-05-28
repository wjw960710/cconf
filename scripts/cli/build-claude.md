build-claude.ts
===

編譯並部署 Claude Code 配置到各子專案的 `.claude/` 目錄。

- 透過 `loadEnv('build-claude')` 載入 `.env` / `.env.local`。
- 來源：`plugins/common*/`（凡是名稱以 `common` 開頭的目錄皆視為共用基底，例如 `common`、`common-admin`）與 `plugins/<project>/`（各專案覆寫）。支援副檔名 `.json`、`.md`。
- 目標：讀取 `<PROJECT>_DIR_PATH` 環境變數作為各專案根目錄；環境變數未設定或目錄不存在則略過該專案。名稱以 `common` 開頭的目錄不會被視為部署目標。
- JSON 檔走 `deepMerge`（物件遞迴合併、陣列串接）：先將所有 `common*` 目錄的 JSON 依目錄名字母序合併成 base，再以各 plugin 為 override；單邊存在則直接採用。輸出寫到 `<target>/.claude/<file>`。
- 非 JSON 檔（如 `.md`）採直接 `copyFile` 覆蓋，不做合併。
- 每寫入一個檔案印出 `[build-claude] <plugin>/.claude/<file>`，結束時印出總寫入數。
