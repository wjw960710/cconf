claude-desktop.ts
===

喚醒 / 啟動 Claude Desktop 桌面應用程式。

- `dac claude-desktop [...args]`（alias `dac cd ...`）：
  - 檢查 `%LOCALAPPDATA%\AnthropicClaude\claude.exe` 是否存在；不存在則報錯並提示安裝。
  - 以 `detached + stdio: 'ignore'` 方式啟動桌面版，並 `unref()` 讓父行程立即退出。
  - 任何後置參數會透傳給 `claude.exe`。
- 目前僅支援 Windows（非 Windows 平台會直接報錯退出）。
