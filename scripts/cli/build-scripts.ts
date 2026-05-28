import { existsSync } from 'node:fs'
import { mkdir, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, relative } from 'node:path'
import { rolldown } from 'rolldown'
import { createLogger } from '../lib/log.js'
import { PROJECT_ROOT } from '../lib/paths.js'

const log = createLogger('build-scripts')
const pluginsDir = join(PROJECT_ROOT, 'plugins')
const nodeModulesDir = join(PROJECT_ROOT, 'node_modules')
const distRoot = join(homedir(), '.ccf')

async function walkTs(dir: string): Promise<string[]> {
	const out: string[] = []
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const p = join(dir, entry.name)
		if (entry.isDirectory()) out.push(...await walkTs(p))
		else if (entry.isFile() && entry.name.endsWith('.ts')) out.push(p)
	}
	return out
}

const plugins = (await readdir(pluginsDir, { withFileTypes: true }))
	.filter(e => e.isDirectory())
	.map(e => e.name)

let built = 0
for (const plugin of plugins) {
	const scriptsDir = join(pluginsDir, plugin, 'scripts')
	if (!existsSync(scriptsDir)) continue
	const files = await walkTs(scriptsDir)
	if (files.length === 0) continue
	const outDir = join(distRoot, `${plugin}-scripts`)
	await rm(outDir, { recursive: true, force: true })
	await mkdir(outDir, { recursive: true })
	await writeFile(join(outDir, 'package.json'), `${JSON.stringify({ type: 'module' }, null, 2)}\n`)
	await symlink(
		nodeModulesDir,
		join(outDir, 'node_modules'),
		process.platform === 'win32' ? 'junction' : 'dir',
	)

	for (const file of files) {
		const rel = relative(scriptsDir, file).replace(/\.ts$/, '.js')
		const outFile = join(outDir, rel)
		const bundle = await rolldown({
			input: file,
			platform: 'node',
			external: id => !id.startsWith('.') && !id.startsWith('/') && !/^[A-Za-z]:[\\/]/.test(id),
		})
		await bundle.write({ file: outFile, format: 'esm', sourcemap: true, minify: true })
		await bundle.close()
		log.log(`${plugin}/${rel.replace(/\\/g, '/')}`)
		built++
	}
}

log.log(`done (${built} file(s))`)
