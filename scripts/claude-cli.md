claude.ts
===

於指定專案目錄下喚醒 / 啟動 `claude` CLI（Claude Code）。

- `ccf claude update` → 透過 `winget upgrade Anthropic.ClaudeCode` 升級 Claude Code 本體。
- `ccf claude [project] [...args]`：
  - 第一個非 `-` 開頭參數視為「專案 prefix」，會比對 `<PROJECT>_DIR_PATH` 環境變數（小寫前綴匹配）。
  - 為空或為 `ai` → 使用本專案（`cconf`）目錄作為 cwd。
  - 多筆匹配時報錯顯示候選；零筆匹配或目錄不存在亦報錯退出。
- 解析後以該專案目錄為 `cwd`，將剩餘參數透傳給 `claude` 並繼承 stdio。
- Windows 下啟用 `shell: true` 以便解析 `claude` 指令路徑。
