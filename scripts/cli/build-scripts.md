build-scripts.ts
===

使用 rolldown 將各 plugin 內 `scripts/` 的 TypeScript 編譯為 ESM JS，部署到使用者家目錄 `~/.ccf/<plugin>-scripts/`。

- 掃描 `plugins/*/scripts/` 下所有 `.ts` 檔（遞迴）。
- 對每個 plugin：
  - 清空並重建輸出目錄 `~/.ccf/<plugin>-scripts/`。
  - 寫入 `package.json`（`{"type":"module"}`）。
  - symlink 跟目錄的 `node_modules` 進去（Windows 用 `junction`、其他平台用 `dir`），讓編譯後的 JS 可直接 `import` 依賴。
- 編譯設定：`platform: 'node'`、`format: 'esm'`、`minify: true`、輸出 sourcemap；node_modules 套件視為 external（不打包）。
- 對應 CLAUDE.md 的「Plugin scripts 部署後路徑」慣例：plugin 內檔案調用以 `node ~/.ccf/<plugin>-scripts/**/*.js` 為準。
