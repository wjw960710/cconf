import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createLogger } from '../lib/log.js'
import { PROJECT_ROOT } from '../lib/paths.js'

const log = createLogger('build-all')

const builds: string[] = [
	'build-scripts.ts',
	'build-claude.ts',
]

await Promise.all(builds.map((file) => {
	const path = join(PROJECT_ROOT, 'scripts', 'cli', file)
	log.log(`run ${file}`)
	return import(pathToFileURL(path).href)
}))

log.log(`done (${builds.length} script(s))`)
