import { spawn, spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv } from './lib/env.js'

loadEnv('open')

const selfRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const isWindows = process.platform === 'win32'
const editors = (process.env.OPEN_EDITOR ?? 'webstorm>idea>code')
	.split('>')
	.map((e) => e.trim())
	.filter(Boolean)

const argv = process.argv.slice(2)
const newWindow = argv.includes('--new') || argv.includes('-n')
const target = (argv.find((a) => !a.startsWith('-')) ?? '').trim().toLowerCase()

function resolveTargetPath(): string {
	if (!target || target === 'ai') return selfRoot

	const candidates = Object.keys(process.env)
		.filter((k) => k.endsWith('_DIR_PATH'))
		.map((k) => ({ name: k.slice(0, -'_DIR_PATH'.length).toLowerCase(), envKey: k }))
		.filter(({ name }) => name.startsWith(target))

	if (candidates.length === 0) {
		console.error(`[open] no project matches "${target}"`)
		process.exit(1)
	}
	if (candidates.length > 1) {
		console.error(`[open] ambiguous "${target}" matches: ${candidates.map((c) => c.name).join(', ')}`)
		process.exit(1)
	}

	const path = process.env[candidates[0].envKey]
	if (!path) {
		console.error(`[open] ${candidates[0].envKey} is empty`)
		process.exit(1)
	}
	return path
}

const openPath = resolveTargetPath()

function exists(cmd: string): boolean {
	const probe = isWindows ? 'where' : 'which'
	return spawnSync(probe, [cmd], { stdio: 'ignore', shell: false }).status === 0
}

for (const editor of editors) {
	if (!exists(editor)) {
		console.log(`[open] ${editor} not found, trying next...`)
		continue
	}
	const args = newWindow && editor === 'code' ? ['-n', openPath] : [openPath]
	if (newWindow && editor !== 'code') {
		console.log(`[open] note: ${editor} 不支援 CLI --new-window，請於 IDE 設定 "Open project in" 為 New window`)
	}
	console.log(`[open] launching ${editor} ${args.join(' ')}`)
	spawn(editor, args, { detached: true, stdio: 'ignore', shell: isWindows }).unref()
	process.exit(0)
}

console.error(`[open] no editor found (tried: ${editors.join(', ')})`)
process.exit(1)
