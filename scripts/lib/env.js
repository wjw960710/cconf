import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createLogger } from './log.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SENTINEL = 'AI_CONF_ENV_LOADED'
const SENTINEL_ON = '1'

/**
 * @param {import('./env.js').LoadEnvOptions} [options]
 */
export function loadEnv(options) {
	const { prefix, mode = 'development' } = options ?? {}
	const log = prefix ? createLogger(prefix) : null
	// sentinel 命中代表 parent 已經 loadEnvFile 過；env 透過 spawn 預設繼承，process.env 已是最新狀態
	if (process.env[SENTINEL] === SENTINEL_ON) {
		log?.log('env already loaded, skip')
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
	if (!log) return
	log.log(loadedFrom.length === 0
		? 'no env file found'
		: `env loaded from ${loadedFrom.join(', ')}`)
}
