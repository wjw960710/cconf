import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const isWindows = process.platform === 'win32'

if (!isWindows) {
	console.error('[claude-desktop] 目前僅支援 Windows')
	process.exit(1)
}

const localAppData = process.env.LOCALAPPDATA
if (!localAppData) {
	console.error('[claude-desktop] 找不到 %LOCALAPPDATA% 環境變數')
	process.exit(1)
}

const exePath = join(localAppData, 'AnthropicClaude', 'claude.exe')
if (!existsSync(exePath)) {
	console.error(`[claude-desktop] 未偵測到 Claude Desktop: ${exePath}`)
	console.error('[claude-desktop] 請先安裝 Claude Desktop')
	process.exit(1)
}

console.log(`[claude-desktop] launching: ${exePath}`)
const child = spawn(exePath, process.argv.slice(2), {
	detached: true,
	stdio: 'ignore',
})
child.on('error', (err) => {
	console.error(`[claude-desktop] 啟動失敗: ${err.message}`)
	process.exit(1)
})
child.unref()
