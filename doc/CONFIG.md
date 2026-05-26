若是專案要調用可以這麼配置 `.claude/settings.json` (因為是私庫所以使用 directory 配置)

```json
{
  "enabledPlugins": {
    "common@claude_config": true
  },
  "extraKnownMarketplaces": {
    "claude_config": {
      "source": {
        "source": "directory",
        "path": "D:\\claude_config"
      }
    }
  }
}
```

接著在專案的 calude 裡輸入以下後重啟 claude

```shell
/plugin marketplace add D:\claude_config
/plugin install common@claude_config
```