import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const builds: string[] = [
	'build-scripts.ts',
	'build-claude.ts',
]

await Promise.all(builds.map((file) => {
	const path = join(root, 'scripts', file)
	console.log(`[build-all] run ${file}`)
	return import(pathToFileURL(path).href)
}))

console.log(`[build-all] done (${builds.length} script(s))`)
