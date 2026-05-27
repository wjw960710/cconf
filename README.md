使用說明
===

## 首次使用

> 在 claude 交互模式下輸入以下指令連接專案(add 後填寫該專案目錄絕對路徑)

```shell
claude
/plugin marketplace add D:\cconf
```

> 安裝專案並配置與分發 AI 配置到各專案

```shell
pnpm run deps                  # 安裝專案依賴
cp .env .env.development.local # 新增並配置 (不敏感配這，AI 默認讀取的 env 檔案)
cp .env .env.local             # 新增並配置 (敏感資訊配這，該檔有配置 DENY 權限)
pnpm run deploy                # 部屬 AI 配置到各專案
```

> (可選) 添加全局鏈接指令

```shell
pnpm setup    # (若沒有初始化過再執行) 初始化 pnpm 全局配置，運行後重啟終端 
pnpm run link # 建立全局 ccf 指令
ccf            # 查看是否能運行，成功的話會有 help 說明
```

---

## 專案開發用

驗證指令，通常不會用到啦

```shell
claude plugin validate .                         # 驗 marketplace.json
```

```shell
claude plugin validate ./plugins/common          # 驗單一 plugin（plugin.json、commands、skills、hooks frontmatter）
```

```shell
claude plugin validate ./plugins/common --strict # CI 用，欄位拼錯也視為錯誤
```