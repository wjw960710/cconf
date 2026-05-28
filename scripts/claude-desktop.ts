import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { createLogger } from './lib/log.js'

const log = createLogger('claude-desktop')
const isWindows = process.platform === 'win32'

if (!isWindows) {
	log.error('目前僅支援 Windows')
	process.exit(1)
}

const localAppData = process.env.LOCALAPPDATA
if (!localAppData) {
	log.error('找不到 %LOCALAPPDATA% 環境變數')
	process.exit(1)
}

const exePath = join(localAppData, 'AnthropicClaude', 'claude.exe')
if (!existsSync(exePath)) {
	log.error(`未偵測到 Claude Desktop: ${exePath}`)
	log.error('請先安裝 Claude Desktop')
	process.exit(1)
}

log.log(`launching: ${exePath}`)
const child = spawn(exePath, process.argv.slice(2), {
	detached: true,
	stdio: 'ignore',
})
child.on('error', (err) => {
	log.error(`啟動失敗: ${err.message}`)
	process.exit(1)
})
child.unref()
