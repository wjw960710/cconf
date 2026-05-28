import { spawn, spawnSync } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv } from './lib/env.js'
import { createLogger } from './lib/log.js'

loadEnv({ prefix: 'open' })

const log = createLogger('open')
const selfRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const isWindows = process.platform === 'win32'

function parseEditors(value: string | undefined): string[] {
	return (value ?? 'webstorm>idea>code')
		.split('>')
		.map((e) => e.trim())
		.filter(Boolean)
}

const argv = process.argv.slice(2)
const newWindow = argv.includes('--new') || argv.includes('-n')
const target = (argv.find((a) => !a.startsWith('-')) ?? '').trim().toLowerCase()

function resolveTarget(): { path: string; editors: string[] } {
	if (!target || target === 'it') {
		return { path: selfRoot, editors: parseEditors(process.env.OPEN_EDITOR) }
	}

	const candidates = Object.keys(process.env)
		.filter((k) => k.endsWith('_DIR_PATH'))
		.map((k) => ({ name: k.slice(0, -'_DIR_PATH'.length).toLowerCase(), envKey: k }))
		.filter(({ name }) => name.startsWith(target))

	if (candidates.length === 0) {
		log.error(`no project matches "${target}"`)
		process.exit(1)
	}
	if (candidates.length > 1) {
		log.error(`ambiguous "${target}" matches: ${candidates.map((c) => c.name).join(', ')}`)
		process.exit(1)
	}

	const { name, envKey } = candidates[0]
	const path = process.env[envKey]
	if (!path) {
		log.error(`${envKey} is empty`)
		process.exit(1)
	}
	if (!existsSync(path) || !statSync(path).isDirectory()) {
		log.error(`${envKey} 目錄不存在: ${path}`)
		process.exit(1)
	}
	const projectEditor = process.env[`${name.toUpperCase()}_OPEN_EDITOR`]?.trim()
	return { path, editors: parseEditors(projectEditor || process.env.OPEN_EDITOR) }
}

const { path: openPath, editors } = resolveTarget()

function exists(cmd: string): boolean {
	const probe = isWindows ? 'where' : 'which'
	return spawnSync(probe, [cmd], { stdio: 'ignore', shell: false }).status === 0
}

for (const editor of editors) {
	if (!exists(editor)) {
		log.log(`${editor} not found, trying next...`)
		continue
	}
	const args = newWindow && editor === 'code' ? ['-n', openPath] : [openPath]
	if (newWindow && editor !== 'code') {
		log.log(`note: ${editor} 不支援 CLI --new-window，請於 IDE 設定 "Open project in" 為 New window`)
	}
	log.log(`launching ${editor} ${args.join(' ')}`)
	spawn(editor, args, { detached: true, stdio: 'ignore', shell: isWindows }).unref()
	process.exit(0)
}

log.error(`no editor found (tried: ${editors.join(', ')})`)
process.exit(1)
