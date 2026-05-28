#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv } from '../scripts/lib/env.js'
import { createLogger } from '../scripts/lib/log.js'

loadEnv()

const log = createLogger('ccf')

const openApps = ['it', ...Object.keys(process.env)
	.filter(k => k.endsWith('_DIR_PATH') && process.env[k])
	.map(k => k.slice(0, -'_DIR_PATH'.length).toLowerCase())]

const commands = {
	update: { alias: 'up', desc: '更新該專案與關聯專案的所有 AI 配置' },
	install: { alias: 'i', desc: '安裝相依套件', run: args => run('pnpm', ['run', 'deps', ...args]) },
	deploy: {
		alias: 'd',
		desc: '部屬 AI 配置到各專案',
	},
	unlink: { desc: '移除 ccf 全域捷徑' },
	open: {
		alias: 'o',
		desc: [
			'依 OPEN_EDITOR 順序開啟專案',
			'  [project] [-n|--new]  選擇要開啟的專案，-n/--new 以新視窗開啟 (僅 vscode 支援)',
			`  可用專案 (startsWith 匹配，空 / it=本專案): ${openApps.join(' | ')}`,
		].join('\n'),
	},
	'claude-cli': {
		alias: 'cc',
		desc: [
			'管理 Claude Code CLI',
			'  update                更新 Claude Code (winget upgrade Anthropic.ClaudeCode)',
			'  [project] [args...]   cd 到 <PROJECT>_DIR_PATH 後執行 claude [args...]',
			`  可用專案 (startsWith 匹配，空 / it=本專案): ${openApps.join(' | ')}`,
		].join('\n'),
	},
	'claude-desktop': {
		alias: 'cd',
		desc: [
			'啟動 Claude Desktop 桌面應用 (Windows)',
			'  [args...]             透傳參數給 claude.exe',
		].join('\n'),
	},
	'project-dir-path': {
		alias: 'pdp',
		desc: [
			'輸出 <PROJECT>_DIR_PATH 的實際路徑（可選擇與子路徑合併）',
			'  [project] [subpath]   project 為小寫 startsWith 匹配，空 / it=本專案',
			'                        subpath 選填，支援 ../、子目錄等（path.resolve 規則）',
			'                        PowerShell: cd (ccf pdp j)',
			'                        bash/zsh  : cd "$(ccf pdp j)"',
			'                        cmd.exe   : for /f "delims=" %i in (\'ccf pdp j\') do cd %i',
			`  可用專案 (startsWith 匹配，空 / it=本專案): ${openApps.join(' | ')}`,
		].join('\n'),
		// pnpm 預設會把 script header 印到 stdout，會污染 (ccf pdp …) 的捕獲值，必須帶 --silent
		run: args => run('pnpm', ['run', '--silent', 'project-dir-path', ...args]),
	},
	serve: {
		alias: 'srv',
		desc: [
			'啟動最小靜態檔案 server（node:http 零依賴）',
			'  [dir] [--port=N] [--host=H]  預設 dir=當前目錄, host=CLI_SERVE_HOST|localhost, port=CLI_SERVE_PORT|11737',
			'                               port 被占用時自動 +1 試到可用 port',
		].join('\n'),
	},
}
const aliases = Object.fromEntries(
	Object.entries(commands).flatMap(([n, c]) => (c.alias ? [[c.alias, n]] : [])),
)

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const isWin = process.platform === 'win32'

function quote(arg) {
	return isWin && /[\s"]/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg
}

// 子腳本 cwd 會被設成 root，原始呼叫目錄會遺失。以 CCF_USER_CWD 帶過去，
// 讓需要「呼叫者目前所在目錄」的子指令（例：ccf serve [dir]）能正確解析相對路徑。
const userCwd = process.cwd()

function run(cmd, args) {
	return new Promise((done) => {
		// 將 cmd + args 自行 quote 後拼成單一字串傳給 shell，避免 Node 20+ 的 DEP0190
		// (shell: true 同時傳 args 陣列會觸發 deprecation warning)
		const line = [cmd, ...args].map(quote).join(' ')
		const child = spawn(line, {
			stdio: 'inherit',
			cwd: root,
			shell: true,
			env: { ...process.env, CCF_USER_CWD: userCwd },
		})
		child.on('exit', code => done(code ?? 1))
		child.on('error', (err) => {
			log.error(`failed to spawn ${cmd}: ${err.message}`)
			done(1)
		})
	})
}

function printHelp() {
	const label = (n, c) => c?.alias ? `${n}, ${c.alias}` : n
	const width = Math.max(8, ...Object.entries(commands)
		.filter(([n]) => !n.startsWith('_'))
		.map(([n, c]) => label(n, c).length))
	const pad = ' '.repeat(2 + width + 1)
	const lines = [
		'Usage: ccf <command>',
		'',
		'Commands:',
		...Object.entries(commands).flatMap(([n, c]) => {
			if (n.startsWith('_')) return []
			const [first, ...rest] = c.desc.split('\n')
			return [`  ${label(n, c).padEnd(width)}  ${first}`, ...rest.map(l => pad + l)]
		}),
		`  ${'help'.padEnd(width)}  顯示說明`,
		'',
		`Project root: ${root}`,
	]
	console.log(lines.join('\n'))
}

const rawArg = process.argv[2]
if (!rawArg || rawArg === 'help' || rawArg === '--help' || rawArg === '-h') {
	printHelp()
	process.exit(rawArg ? 0 : 1)
}

const arg = aliases[rawArg] ?? rawArg
const cmd = commands[arg]
if (!cmd) {
	log.error(`unknown command: ${rawArg}\n`)
	printHelp()
	process.exit(1)
}

const extraArgs = process.argv.slice(3)
process.exit(await (cmd.run ? cmd.run(extraArgs) : run('pnpm', ['run', arg, ...extraArgs])))
