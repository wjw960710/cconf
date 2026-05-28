git-pull.ts
===

以 token 認證的方式 `git pull` 本專案，作為 `update.ts` 的前置步驟。

- 透過 `loadEnv('git-pull')` 載入環境變數，要求 `GIT_TOKEN` 必須設定（否則直接 exit 0 跳過）。
- 讀取 `remote.origin.url`，將 username/password 改寫為 `oauth2:<token>`，僅支援 http(s) remote。
- 拉取當前分支，期間以 `GIT_TERMINAL_PROMPT=0` 與 `-c credential.helper=` 防止互動彈窗。
- 比對 pull 前後 HEAD：
  - 無新 commit → exit `EXIT_NO_NEW_COMMITS` (10)。
  - 有新 commit → exit 0。
- 退出碼定義於 `lib/exit-codes.ts`，由 `update.ts` 依此判斷後續流程。
