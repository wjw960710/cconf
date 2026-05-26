import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SENTINEL = 'AI_CONF_ENV_LOADED'
const SENTINEL_ON = '1'

/**
 * @param {import('./env.js').LoadEnvOptions} [options]
 */
export function loadEnv(options) {
	const { prefix, mode } = options ?? {}
	// sentinel 命中代表 parent 已經 loadEnvFile 過；env 透過 spawn 預設繼承，process.env 已是最新狀態
	if (process.env[SENTINEL] === SENTINEL_ON) {
		if (prefix) console.log(`[${prefix}] env already loaded, skip`)
		return
	}
	// process.loadEnvFile 不覆蓋已存在鍵，故由高 → 低排序、先讀者勝出
	const envFiles = mode
		? ['.env.local', `.env.${mode}.local`, `.env.${mode}`, '.env']
		: ['.env.local', '.env']
	const loadedFrom = []
	for (const name of envFiles) {
		const path = join(root, name)
		if (!existsSync(path)) continue
		process.loadEnvFile(path)
		loadedFrom.push(name)
	}
	process.env[SENTINEL] = SENTINEL_ON
	if (!prefix) return
	console.log(loadedFrom.length === 0
		? `[${prefix}] no env file found`
		: `[${prefix}] env loaded from ${loadedFrom.join(', ')}`)
}
