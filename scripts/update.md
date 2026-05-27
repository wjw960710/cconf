update.ts
===

`dac update` 主流程：拉取最新程式碼 → 安裝依賴 → 重新部署，串連 `git-pull.ts`、`pnpm run deps`、`pnpm run deploy`。

- 步驟 1：`tsx scripts/git-pull.ts`
  - exit `EXIT_NO_NEW_COMMITS` (10) → 沒有新 commit，整個 update 結束（exit 0）。
  - 其他非 0 exit → 直接以該 exit code 中止。
- 步驟 2：`pnpm run deps`（安裝/更新依賴），失敗則中止。
- 步驟 3：`pnpm run deploy`（呼叫 build-all 部署），由其退出碼決定最終 exit code。
- Windows 下對 `pnpm`、`tsx` 開啟 `shell: true`，以解析 .cmd shim。
