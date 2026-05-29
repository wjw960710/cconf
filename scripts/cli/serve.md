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
| `[dir]` | 當前目錄 | 要提供服務的目錄；相對路徑以呼叫者實際 cwd 解析（透過 `CLI_SERVE_USER_CWD`）。 |
| `--port`, `-p` | `CLI_SERVE_PORT`（fallback `11737`） | 監聽 port，1–65535 整數。 |
| `--host`, `-h` | `CLI_SERVE_HOST`（fallback `localhost`） | 監聽 host。 |

## Host / Port 配置與占用回退

- 透過 `loadEnv({ prefix: 'serve' })` 載入 `.env` / `.env.local`。
- 預設 host / port 從環境變數 `CLI_SERVE_HOST` / `CLI_SERVE_PORT` 讀取（於 `.env` 中設定，預設 `localhost` / `11737`）；port 值非合法整數時 fallback 為 `11737`。
- CLI 參數 `--host` / `--port` 優先級皆高於環境變數。
- 啟動時若該 port 已被占用（`EADDRINUSE`），自動嘗試 `+1` 直到找到可用 port；最多重試 100 次，超過則終止並回報錯誤。
- 每次回退會以 `[serve] port N in use, trying N+1` 提示。

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

啟動時的網址列印仿照 vite，依 host 模式輸出 `Local` / `Network` 兩種，網址結尾**不**帶 `/`：

- host = `localhost` / `127.0.0.1` / `::1`：只印 `Local http://localhost:<port>`。
- host = `0.0.0.0` / `::`（wildcard）：印 `Local` 加上每張非 internal IPv4 介面的 `Network` 行；若找不到對外介面，會印 `Network use --host to expose` 提示。
- 指定具體 IP：印 `Local http://<host>:<port>`。

## 範例

```
$ ccf serve
[serve] serving D:\workspace
[serve] Local   http://localhost:11737

$ ccf srv ./public --port=8080 --host=0.0.0.0
[serve] serving D:\workspace\public
[serve] Local   http://localhost:8080
[serve] Network http://10.0.0.1:8080
[serve] Network http://10.0.0.2:8080
```

## 結束

收到 `SIGINT` / `SIGTERM`（Ctrl+C）時，呼叫 `server.close()` 後以 exit code 0 結束。

## 跨平台

- 路徑組合使用 `node:path` 的 `resolve` / `join`。
- Server 為純 Node API，不依賴任何平台特定指令。

## 相關檔案

- `bin/ccf.mjs` — 子指令註冊；注入 `CLI_SERVE_USER_CWD` 讓相對路徑能對應呼叫者實際 cwd。
- `package.json` `scripts.serve` — 透過 tsx 執行入口。
- `scripts/lib/log.js` — `[serve]` log 前綴來源。
