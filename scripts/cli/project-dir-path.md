project-dir-path.ts
===

> 對應 `ccf project-dir-path` 子指令（alias `pdp`）。把 `<PROJECT>_DIR_PATH` 解析為實際路徑後輸出 stdout，可供 shell 取代成 `cd` 的參數。

## 用法

```
ccf project-dir-path [project] [subpath]
ccf pdp [project] [subpath]
```

- `[project]`：小寫名稱，對 `process.env` 中所有 `*_DIR_PATH` 鍵以 `startsWith` 匹配（與 `ccf open`、`ccf cc` 同規則）。省略或為 `it` 時代表本專案。
- `[subpath]`：選填，與專案根目錄合併（內部使用 `path.resolve`，因此支援 `../`、子目錄、絕對路徑覆蓋）。

匹配為 0 或 ≥2 時 exit 1 並寫 stderr。

### 輸出

只印一行最終路徑（含 `\n`），不混雜任何 log。錯誤訊息一律走 stderr，方便：

```powershell
cd (ccf pdp j)            # PowerShell
```

```bash
cd "$(ccf pdp j)"         # bash / zsh
```

### 範例

```
$ ccf pdp j
D:\proj\jackpot-client

$ ccf pdp j ../
D:\proj

$ ccf pdp it
D:\proj\cconf

$ ccf pdp
D:\proj\cconf
```

## 錯誤情境

| 情境 | 訊息 |
| --- | --- |
| 多餘參數（>2） | 印 usage |
| 沒有任何 `*_DIR_PATH` 鍵以該前綴開頭 | `no project matches "<input>"` |
| 多個 `*_DIR_PATH` 鍵以該前綴開頭 | `ambiguous "<input>" matches: a, b, c` |
| 命中的鍵值為空字串 | `<KEY>_DIR_PATH is empty` |

## 跨平台

- 路徑組合使用 `node:path` 的 `resolve`，遵守本專案跨平台撰寫原則。
- `console.log` 輸出含換行；`(...)` / `$(...)` 在兩種 shell 都會吃掉尾端空白，行為一致。

## 相關檔案

- `bin/ccf.mjs` — 子指令註冊
- `package.json` `scripts.project-dir-path` — 透過 tsx 執行入口
- `scripts/lib/env.js` — `loadEnv()` 共用 env 載入器
- `scripts/open.ts` — 相同的 `startsWith` 專案匹配規則來源
