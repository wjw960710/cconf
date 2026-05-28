#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv } from '../scripts/lib/env.js'
import { createLogger } from '../scripts/lib/log.js'

loadEnv()

const log = createLogger('ccf')

const openApps = ['ai', ...Object.keys(process.env)
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
			`  可用專案 (startsWith 匹配，ai=本專案): ${openApps.join(' | ')}`,
		].join('\n'),
	},
	'claude-cli': {
		alias: 'cc',
		desc: [
			'管理 Claude Code CLI',
			'  update                更新 Claude Code (winget upgrade Anthropic.ClaudeCode)',
			'  <project> [args...]   cd 到 <PROJECT>_DIR_PATH 後執行 claude [args...]',
			`  可用專案 (startsWith 匹配，ai=本專案): ${openApps.join(' | ')}`,
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
			'  <project> [subpath]   project 為小寫 startsWith 匹配，ai=本專案',
			'                        subpath 選填，支援 ../、子目錄等（path.resolve 規則）',
			'                        PowerShell: cd (ccf pdp j)',
			'                        bash/zsh  : cd "$(ccf pdp j)"',
			'                        cmd.exe   : for /f "delims=" %i in (\'ccf pdp j\') do cd %i',
			`  可用專案 (startsWith 匹配，ai=本專案): ${openApps.join(' | ')}`,
		].join('\n'),
		// pnpm 預設會把 script header 印到 stdout，會污染 (ccf pdp …) 的捕獲值，必須帶 --silent
		run: args => run('pnpm', ['run', '--silent', 'project-dir-path', ...args]),
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

function run(cmd, args) {
	return new Promise((done) => {
		const child = spawn(quote(cmd), args.map(quote), {
			stdio: 'inherit',
			cwd: root,
			shell: true,
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
