lib/exit-codes.ts
===

集中定義 `scripts/` 之間以 exit code 傳遞狀態的常數，避免魔法數字散落。

- `EXIT_NO_NEW_COMMITS = 10` — `git-pull.ts` 拉取後與 pull 前 HEAD 相同（沒有新 commit）。
- `EXIT_NO_SCRIPTS_CHANGE = 11` — 有新 commit，但變更檔案皆不在 `scripts/` 或 `plugins/*/scripts/`。
- 主要由 `update.ts` 解讀 `git-pull.ts` 的退出碼以決定後續 deps / deploy 流程。新增退出碼時請同步更新此檔與本 MD。
