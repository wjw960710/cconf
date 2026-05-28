import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { createLogger } from '../lib/log.js'

const log = createLogger('build-extensions')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const extensionsDir = join(root, 'extensions')
const SIZES = [16, 32, 48, 128] as const

async function buildOne(extName: string): Promise<void> {
	const extDir = join(extensionsDir, extName)
	const sourceSvg = join(extDir, 'source.svg')
	if (!existsSync(sourceSvg)) {
		log.warn(`skip ${extName}: missing source.svg`)
		return
	}

	const iconsDir = join(extDir, 'icons')
	await mkdir(iconsDir, { recursive: true })
	const svg = await readFile(sourceSvg)

	for (const size of SIZES) {
		const outPath = join(iconsDir, `icon-${size}.png`)
		await sharp(svg, { density: 384 })
			.resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
			.png({ compressionLevel: 9 })
			.toFile(outPath)
	}
	log.log(`built ${extName} icons -> ${iconsDir.replace(/\\/g, '/')}`)
}

if (!existsSync(extensionsDir)) {
	log.error(`extensions directory not found: ${extensionsDir.replace(/\\/g, '/')}`)
	process.exit(1)
}

const targets = process.argv.slice(2)
const entries = (await readdir(extensionsDir, { withFileTypes: true }))
	.filter((e) => e.isDirectory())
	.map((e) => e.name)
	.filter((name) => targets.length === 0 || targets.includes(name))

if (entries.length === 0) {
	log.warn(targets.length > 0
		? `no matching extensions for: ${targets.join(', ')}`
		: 'no extensions found under extensions/')
	process.exit(0)
}

for (const name of entries) {
	await buildOne(name)
}
log.log(`done (${entries.length} extension${entries.length > 1 ? 's' : ''})`)
