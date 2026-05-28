import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv } from './lib/env.js'
import { createLogger } from './lib/log.js'

loadEnv()

const log = createLogger('project-dir-path')
const selfRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function fail(message: string): never {
	log.error(message)
	process.exit(1)
}

function usage(): never {
	console.error(`Usage: ccf project-dir-path <project> [subpath]`)
	console.error(`  <project>: <PROJECT>_DIR_PATH 中的 PROJECT 名稱（小寫，startsWith 匹配；ai=本專案）`)
	console.error(`  [subpath]: 選填，與專案根目錄合併輸出（支援 ../、子目錄等）`)
	process.exit(1)
}

const argv = process.argv.slice(2)
if (argv.length === 0 || argv.length > 2) usage()

const [rawProject, subpath] = argv
const target = rawProject.trim().toLowerCase()
if (!target) usage()

function resolveProjectDir(): string {
	if (target === 'ai') return selfRoot

	const candidates = Object.keys(process.env)
		.filter(k => k.endsWith('_DIR_PATH'))
		.map(k => ({ name: k.slice(0, -'_DIR_PATH'.length).toLowerCase(), envKey: k }))
		.filter(({ name }) => name.startsWith(target))

	if (candidates.length === 0) fail(`no project matches "${rawProject}"`)
	if (candidates.length > 1) {
		fail(`ambiguous "${rawProject}" matches: ${candidates.map(c => c.name).join(', ')}`)
	}

	const { envKey } = candidates[0]
	const value = process.env[envKey]
	if (!value) fail(`${envKey} is empty`)
	return value
}

const projectDir = resolveProjectDir()
const finalPath = subpath ? resolve(projectDir, subpath) : resolve(projectDir)
console.log(finalPath)
