lib/paths.js
===

集中導出 `scripts/` 與其他子目錄共用的路徑常數，避免每個腳本重複寫 `resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')`。

## 匯出

- `PROJECT_ROOT: string` — 本專案（cconf）repo 的絕對路徑，由 `scripts/lib/paths.js` 自身位置往上兩層（`scripts/lib/` → `scripts/` → repo root）推導。

## 使用方式

```ts
import { join } from 'node:path'
import { PROJECT_ROOT } from '../lib/paths.js'

const pluginsDir = join(PROJECT_ROOT, 'plugins')
```

## 備註

- 以 `.js` 形式存放是為了讓 tsx 直接執行與 rolldown 編譯後的 plugin scripts 都能 import 同一份檔案；型別由 `paths.d.ts` 提供。
- 因 `scripts/lib/` 與 repo root 的相對層級固定，常數可在模組載入時一次計算後 freeze 為 const，不需 lazy 解析。
- 命名刻意用 `PROJECT_ROOT`（而非 `ROOT`），避免與呼叫端的局部 `root` 變數混淆，也保留未來擴充其他路徑常數（如 `PLUGINS_DIR`）的空間。
