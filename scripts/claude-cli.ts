import { spawnSync } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv } from './lib/env.js'
import { createLogger } from './lib/log.js'

loadEnv({ prefix: 'claude' })

const log = createLogger('claude')
const selfRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const isWindows = process.platform === 'win32'

const argv = process.argv.slice(2)
const first = argv[0]

if (first === 'update') {
	const result = spawnSync('winget', ['upgrade', 'Anthropic.ClaudeCode'], {
		stdio: 'inherit',
		shell: true,
	})
	process.exit(result.status ?? 1)
}

function resolveTargetPath(target: string): string {
	if (!target || target === 'it') return selfRoot

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

	const path = process.env[candidates[0].envKey]
	if (!path) {
		log.error(`${candidates[0].envKey} is empty`)
		process.exit(1)
	}
	if (!existsSync(path) || !statSync(path).isDirectory()) {
		log.error(`${candidates[0].envKey} 目錄不存在: ${path}`)
		process.exit(1)
	}
	return path
}

const target = (first ?? '').trim().toLowerCase()
const isProjectArg = target && !target.startsWith('-')
const cwd = resolveTargetPath(isProjectArg ? target : '')
const passthrough = isProjectArg ? argv.slice(1) : argv

log.log(`cwd: ${cwd}`)
const result = spawnSync('claude', passthrough, {
	stdio: 'inherit',
	shell: isWindows,
	cwd,
})
process.exit(result.status ?? 1)
