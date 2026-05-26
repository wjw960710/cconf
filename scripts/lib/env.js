import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

// 後者不會覆蓋已存在的鍵，所以把優先序高的 .env.local 放前面
const envFiles = ['.env.local', '.env']

export function loadEnv(logPrefix) {
	const loadedFrom = []
	for (const name of envFiles) {
		const path = join(root, name)
		if (!existsSync(path)) continue
		process.loadEnvFile(path)
		loadedFrom.push(name)
	}
	if (!logPrefix) return
	console.log(loadedFrom.length === 0
		? `[${logPrefix}] no env file found`
		: `[${logPrefix}] env loaded from ${loadedFrom.join(', ')}`)
}
