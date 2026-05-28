import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createLogger } from '../lib/log.js'

const log = createLogger('build-all')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

const builds: string[] = [
	'build-scripts.ts',
	'build-claude.ts',
]

await Promise.all(builds.map((file) => {
	const path = join(root, 'scripts', 'cli', file)
	log.log(`run ${file}`)
	return import(pathToFileURL(path).href)
}))

log.log(`done (${builds.length} script(s))`)
