import { existsSync } from 'node:fs'
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv } from './lib/env.js'
import { createLogger } from './lib/log.js'

const log = createLogger('build-claude')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pluginsDir = join(root, 'plugins')

const supportedExts = ['.json', '.md']

loadEnv({ prefix: 'build-claude' })

function isPlainObject(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function deepMerge<T>(base: T, override: T): T {
	if (isPlainObject(base) && isPlainObject(override)) {
		const out: Record<string, unknown> = { ...base }
		for (const [k, v] of Object.entries(override)) {
			out[k] = k in base ? deepMerge((base as Record<string, unknown>)[k], v) : v
		}
		return out as T
	}
	if (Array.isArray(base) && Array.isArray(override)) {
		return [...base, ...override] as T
	}
	return override
}

async function listTopFiles(dir: string): Promise<{ name: string, path: string, ext: string }[]> {
	if (!existsSync(dir)) return []
	const out: { name: string, path: string, ext: string }[] = []
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		if (!entry.isFile()) continue
		const ext = extname(entry.name)
		if (!supportedExts.includes(ext)) continue
		out.push({ name: entry.name, path: join(dir, entry.name), ext })
	}
	return out
}

const allDirs = (await readdir(pluginsDir, { withFileTypes: true }))
	.filter(e => e.isDirectory())
	.map(e => e.name)

const commonDirs = allDirs.filter(name => name.startsWith('common')).sort()

const commonJsonByName = new Map<string, unknown>()
for (const dir of commonDirs) {
	for (const f of await listTopFiles(join(pluginsDir, dir))) {
		if (f.ext !== '.json') continue
		const next = JSON.parse(await readFile(f.path, 'utf8'))
		const prev = commonJsonByName.get(f.name)
		commonJsonByName.set(f.name, prev === undefined ? next : deepMerge(prev, next))
	}
}

const plugins = allDirs.filter(name => !name.startsWith('common'))

let written = 0
for (const plugin of plugins) {
	const envKey = `${plugin.toUpperCase()}_DIR_PATH`
	const target = process.env[envKey]
	if (!target) {
		log.log(`${plugin}: ${envKey} not set, skip`)
		continue
	}
	if (!existsSync(target)) {
		log.log(`${plugin}: ${envKey}=${target} not found, skip`)
		continue
	}

	const outDir = join(target, '.claude')
	await mkdir(outDir, { recursive: true })

	const pluginFiles = await listTopFiles(join(pluginsDir, plugin))
	const pluginJsonByName = new Map<string, unknown>()
	for (const f of pluginFiles) {
		if (f.ext !== '.json') continue
		pluginJsonByName.set(f.name, JSON.parse(await readFile(f.path, 'utf8')))
	}

	const jsonNames = new Set<string>([...commonJsonByName.keys(), ...pluginJsonByName.keys()])
	for (const name of jsonNames) {
		const base = commonJsonByName.get(name)
		const override = pluginJsonByName.get(name)
		const merged = base === undefined ? override : override === undefined ? base : deepMerge(base, override)
		await writeFile(join(outDir, name), `${JSON.stringify(merged, null, 2)}\n`)
		log.log(`${plugin}/.claude/${name}`)
		written++
	}

	for (const f of pluginFiles) {
		if (f.ext === '.json') continue
		await copyFile(f.path, join(outDir, f.name))
		log.log(`${plugin}/.claude/${f.name}`)
		written++
	}
}

log.log(`done (${written} file(s))`)
