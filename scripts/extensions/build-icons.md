build-icons
===

掃描 `extensions/` 下每個子目錄，將其 `source.svg` 透過 sharp 渲染為 4 種尺寸 PNG（16/32/48/128），輸出到該子目錄的 `icons/`，供 Chrome extension manifest 的 `icons` / `action.default_icon` 直接引用。

## 使用

```bash
pnpm run build-extensions          # 重生所有 extensions/* 的 icons
pnpm run build-extensions chrome   # 只重生指定 extension（可帶多個）
```

## 規則

- 來源檔固定為 `extensions/<name>/source.svg`；找不到時略過該 extension 並警告。
- 輸出固定為 `extensions/<name>/icons/icon-{16,32,48,128}.png`，已存在會覆蓋。
- `density: 384` 確保小尺寸 raster 化時細節不糊；採 `contain` 並以透明背景填邊。
- 透過 `process.argv.slice(2)` 接受白名單；不帶參數則跑全部。

## 為何放在 `scripts/extensions/`

`scripts/cli/` 是 `ccf` 子指令的實作目錄；`extensions/` 相關（如 icon 產生）屬於開發輔助腳本，獨立分組便於擴充其他 extension 工具（如打包、版本號 bump）。共用工具（`createLogger` 等）放在 `scripts/lib/`。
