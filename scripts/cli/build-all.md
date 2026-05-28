build-all.ts
===

並行執行所有 build 流程的入口腳本。

- 以 `import()` 動態載入 `scripts/` 下的多個 build 腳本（目前為 `build-scripts.ts` 與 `build-claude.ts`），透過 `Promise.all` 並行執行。
- 每執行一個腳本前印出 `[build-all] run <file>`，全部完成後印出 `done (N script(s))`。
- 對應 `ccf` 的「一次跑完所有 build」指令；新增 build 腳本時，將檔名加入 `builds` 陣列即可。
