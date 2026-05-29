serve.ts
===

> 對應 `ccf serve` 子指令（alias `srv`）。在本機啟動最小靜態檔案 server（基於 Node 內建 `node:http` / `node:https`），供快速預覽任意目錄的靜態檔案使用；可選 HTTPS，憑證預設用 `selfsigned` 套件自動產生，亦可手動指定。另支援自動探查 `serve.config.*`，以 vite 風格 `server.proxy` 設定將特定路徑轉發到後端（HTTP / WebSocket）。

## 用法

```
ccf serve [dir] [--port=N] [--host=H] [--https] [--cert=PATH --key=PATH]
ccf srv  [dir] [--port=N] [--host=H] [--https] [--cert=PATH --key=PATH]
```

| 參數 | 預設 | 說明 |
| --- | --- | --- |
| `[dir]` | 當前目錄 | 要提供服務的目錄；相對路徑以呼叫者實際 cwd 解析（透過 `CLI_SERVE_USER_CWD`）。 |
| `--port`, `-p` | `CLI_SERVE_PORT`（fallback `11737`） | 監聽 port，1–65535 整數。 |
| `--host`, `-h` | `CLI_SERVE_HOST`（fallback `localhost`） | 監聽 host。 |
| `--https` | 關閉（HTTP） | 啟用 HTTPS；未搭配 `--cert`/`--key` 時自動以 `selfsigned` 產生 self-signed 憑證（CN 取自 `--host`，預設 `localhost`，有效 365 天）。 |
| `--cert` | — | 憑證檔案路徑；相對路徑以呼叫者實際 cwd 解析。必須與 `--key` 同時提供，且需搭配 `--https`，否則參數錯誤。 |
| `--key` | — | 私鑰檔案路徑；相對路徑以呼叫者實際 cwd 解析。必須與 `--cert` 同時提供。 |

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

啟動時的網址列印仿照 vite，依 host 模式輸出 `Local` / `Network` 兩種，網址結尾**不**帶 `/`，scheme 隨 `--https` 切換為 `http` 或 `https`：

- host = `localhost` / `127.0.0.1` / `::1`：只印 `Local <scheme>://localhost:<port>`。
- host = `0.0.0.0` / `::`（wildcard）：印 `Local` 加上每張非 internal IPv4 介面的 `Network` 行；若找不到對外介面，會印 `Network use --host to expose` 提示。
- 指定具體 IP：印 `Local <scheme>://<host>:<port>`。

## HTTPS

- 帶 `--https` 旗標即啟用 TLS，server 改用 `node:https.createServer`。
- 未提供 `--cert` / `--key` 時：使用 `selfsigned` 套件即時產生 self-signed 憑證（無檔案落地），CN 取自 `--host`（或 `localhost`），RSA 2048、有效 365 天；瀏覽器第一次連線會出現「不受信任」警告需手動信任。
- 提供 `--cert` / `--key` 時：兩個參數需同時帶，相對路徑會以呼叫者 cwd 解析（與 `[dir]` 同規則），讀檔失敗會以 exception 終止。
- 參數錯誤情境：只帶 `--cert` 或只帶 `--key` 會以 exit 1 終止；帶 `--cert`/`--key` 但沒帶 `--https` 也會終止。

## Server Proxy（vite 風格）

啟動時會依下列順序自動探查 proxy 設定檔，找到第一個即停止（不存在則不啟用 proxy）：

1. 呼叫者 cwd（`CLI_SERVE_USER_CWD`，由 `bin/ccf.mjs` 注入；未注入時為 `process.cwd()`）
2. `[dir]`（實際提供服務的目錄）

每個目錄依下列順序檢查檔名：

```
serve.config.ts
serve.config.mts
serve.config.js
serve.config.mjs
serve.config.cjs
serve.config.json
```

- `.ts` / `.mts` 透過 `tsx` runtime 直接 `import()` 載入（本指令以 `tsx` 執行，loader 已註冊）。
- `.js` / `.mjs` / `.cjs` 走原生 ESM `import()`。
- `.json` 以 `fs.readFile` + `JSON.parse` 讀取。
- 載入失敗（語法錯誤、模組未匯出物件等）會以 `[serve] failed to load config …` 終止並 exit 1。

### 設定型別

```ts
export interface ServeConfig {
  proxy?: Record<string, ServeProxyValue>
}

export type ServeProxyValue = string | ServeProxyEntry

export interface ServeProxyEntry {
  target: string                                                  // 必填，e.g. http://localhost:3000 / ws://localhost:5174
  changeOrigin?: boolean                                          // 預設 false；改寫 Host header 為 target 的 host
  secure?: boolean                                                // 預設 true；轉發到 https target 時，false 可關閉憑證驗證（self-signed 後端常用）
  ws?: boolean                                                    // 預設 false；同時代理對應路徑的 WebSocket upgrade
  rewrite?: ((path: string) => string) | { from: string; to: string } // 改寫被轉發的 path；物件式為 path.replace(new RegExp(from), to)
  headers?: Record<string, string>                                // 額外附加到 outbound 請求的 header
}
```

### 路徑比對規則（與 vite 對齊）

- key **以 `^` 開頭**：視為 RegExp（`new RegExp(key)`）。
- key **不以 `^` 開頭**：純前綴比對（`url.startsWith(key)`）。
- 遵循 `proxy` 物件的鍵宣告順序，第一個命中即停止往下。
- 命中後若 `rewrite` 為 function 則 `req.url = rewrite(req.url)`；為物件式則 `req.url = req.url.replace(new RegExp(from), to)`。

### WebSocket

只要 `proxy` 中**任一**規則 `ws: true`，server 就會註冊 `upgrade` 事件處理器；未匹配到 `ws: true` 規則的 upgrade 會直接 `socket.destroy()`。

### 範例設定檔

`serve.config.ts`：

```ts
import type { ServeConfig } from './scripts/cli/serve.ts'

export default {
  proxy: {
    // 字串短寫：所有 /api/* 轉發到 http://localhost:3000，不改 path
    '/api': 'http://localhost:3000',

    // 物件式 + changeOrigin + rewrite（剝掉 /v2 前綴）
    '/v2': {
      target: 'https://api.example.com',
      changeOrigin: true,
      rewrite: (p) => p.replace(/^\/v2/, ''),
    },

    // self-signed 後端 → 關閉憑證驗證
    '/internal': {
      target: 'https://localhost:8443',
      secure: false,
      changeOrigin: true,
    },

    // WebSocket（含 socket.io HMR 等）
    '/socket.io': {
      target: 'ws://localhost:5174',
      ws: true,
    },

    // RegExp key：^ 開頭視為 RegExp
    '^/fallback/.*': {
      target: 'http://jsonplaceholder.typicode.com',
      changeOrigin: true,
      rewrite: { from: '^/fallback', to: '' },
    },
  },
} satisfies ServeConfig
```

`serve.config.json`（rewrite 改用物件式）：

```json
{
  "proxy": {
    "/api": {
      "target": "http://localhost:3000",
      "changeOrigin": true,
      "rewrite": { "from": "^/api", "to": "" }
    },
    "/ws": {
      "target": "ws://localhost:3001",
      "ws": true
    }
  }
}
```

### 啟動 log

```
[serve] loaded config: D:\workspace\serve.config.ts
[serve] proxy /api -> http://localhost:3000
[serve] proxy /v2 -> https://api.example.com [changeOrigin,rewrite]
[serve] proxy /socket.io -> ws://localhost:5174 [ws]
```

### 套件

- 底層使用 [`http-proxy-3`](https://www.npmjs.com/package/http-proxy-3)（vite 採用的 `http-proxy` 現代 fork）；錯誤統一在 `proxy.on('error')` 內以 502 回應，避免 server crash。

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

$ ccf serve --https
[serve] generated self-signed TLS cert (CN=localhost, 365d)
[serve] serving D:\workspace
[serve] Local   https://localhost:11737

$ ccf serve --https --cert ./cert.pem --key ./key.pem
[serve] loaded TLS cert: D:\workspace\cert.pem
[serve] loaded TLS key:  D:\workspace\key.pem
[serve] serving D:\workspace
[serve] Local   https://localhost:11737
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
