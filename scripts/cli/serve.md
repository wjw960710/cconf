serve.ts
===

> 對應 `ccf serve` 子指令（alias `srv`）。在本機啟動最小靜態檔案 HTTP server（基於 Node 內建 `node:http`，零依賴），供快速預覽任意目錄的靜態檔案使用。

## 用法

```
ccf serve [dir] [--port=N] [--host=H]
ccf srv  [dir] [--port=N] [--host=H]
```

| 參數 | 預設 | 說明 |
| --- | --- | --- |
| `[dir]` | 當前目錄 | 要提供服務的目錄；相對路徑以呼叫者實際 cwd 解析（透過 `CCF_USER_CWD`）。 |
| `--port`, `-p` | `11737` | 監聽 port，1–65535 整數。 |
| `--host`, `-h` | `localhost` | 監聽 host。 |

## 路由規則

| URL | 對應檔案 |
| --- | --- |
| `/`、`/index`、`/index.html`、空字串 | `<dir>/index.html` |
| `/foo`（檔案存在） | `<dir>/foo` |
| `/foo`（目錄存在） | `<dir>/foo/index.html` |
| `/foo`（同名 `.html` 存在） | `<dir>/foo.html` |
| 其他 | 404 |

- **Path traversal 防護**：以 `path.resolve` 解析後檢查最終路徑必須位於 `<dir>` 之下，否則 404。
- **MIME**：內建常見類型對照（html / css / js / json / svg / png / jpg / gif / webp / ico / txt / wasm），其他以 `application/octet-stream` 回傳。

## 輸出

統一以 `createLogger('serve')` 的 `[serve]` 前綴輸出 log（stdout 不會被當作命令結果消費），每筆請求印 status / method / url / 解析到的檔案。

## 範例

```
$ ccf serve
[serve] serving D:\workspace
[serve] http://localhost:11737/

$ ccf serve experiments/www
[serve] serving D:\...\cconf\experiments\www
[serve] http://localhost:11737/

$ ccf srv ./public --port=8080 --host=0.0.0.0
[serve] serving D:\workspace\public
[serve] http://0.0.0.0:8080/
```

## 結束

收到 `SIGINT` / `SIGTERM`（Ctrl+C）時，呼叫 `server.close()` 後以 exit code 0 結束。

## 跨平台

- 路徑組合使用 `node:path` 的 `resolve` / `join`。
- Server 為純 Node API，不依賴任何平台特定指令。

## 相關檔案

- `bin/ccf.mjs` — 子指令註冊；注入 `CCF_USER_CWD` 讓相對路徑能對應呼叫者實際 cwd。
- `package.json` `scripts.serve` — 透過 tsx 執行入口。
- `scripts/lib/log.js` — `[serve]` log 前綴來源。
