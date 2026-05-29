import { createServer, type Server } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { networkInterfaces } from 'node:os'
import { extname, isAbsolute, join, resolve, sep } from 'node:path'

import { loadEnv } from '../lib/env.js'
import { createLogger } from '../lib/log.js'

loadEnv({ prefix: 'serve' })

const log = createLogger('serve')

const FALLBACK_HOST = 'localhost'
const FALLBACK_PORT = 11737
const MAX_PORT_RETRIES = 100

interface Options {
	dir: string
	port: number
	host: string
}

function envPort(): number {
	const raw = process.env.CLI_SERVE_PORT
	if (!raw) return FALLBACK_PORT
	const n = Number(raw)
	if (!Number.isInteger(n) || n <= 0 || n > 65535) {
		log.warn(`invalid CLI_SERVE_PORT=${raw}, falling back to ${FALLBACK_PORT}`)
		return FALLBACK_PORT
	}
	return n
}

function envHost(): string {
	const raw = process.env.CLI_SERVE_HOST?.trim()
	return raw || FALLBACK_HOST
}

function usage(): never {
	console.error('Usage: ccf serve [dir] [--port=N] [--host=H]')
	console.error('  [dir]         欲提供服務的目錄（預設：當前目錄）')
	console.error('  --port, -p    監聽 port（預設：11737）')
	console.error('  --host, -h    監聽 host（預設：localhost）')
	process.exit(1)
}

function parseArgs(argv: string[]): Options {
	let dir: string | undefined
	let port = envPort()
	let host = envHost()

	for (let i = 0; i < argv.length; i++) {
		const a = argv[i]!
		if (a === '--help' || a === '-?') usage()

		const eq = a.indexOf('=')
		const key = eq >= 0 ? a.slice(0, eq) : a
		const inlineVal = eq >= 0 ? a.slice(eq + 1) : undefined
		const takeVal = (): string => {
			if (inlineVal !== undefined) return inlineVal
			const v = argv[++i]
			if (v === undefined) usage()
			return v
		}

		if (key === '--port' || key === '-p') {
			const n = Number(takeVal())
			if (!Number.isInteger(n) || n <= 0 || n > 65535) usage()
			port = n
		} else if (key === '--host' || key === '-h') {
			host = takeVal()
		} else if (a.startsWith('-')) {
			usage()
		} else if (dir === undefined) {
			dir = a
		} else {
			usage()
		}
	}

	const userCwd = process.env.CLI_SERVE_USER_CWD ?? process.cwd()
	const resolvedDir = dir === undefined
		? userCwd
		: (isAbsolute(dir) ? resolve(dir) : resolve(userCwd, dir))

	return { dir: resolvedDir, port, host }
}

const MIME: Record<string, string> = {
	'.html': 'text/html; charset=utf-8',
	'.htm':  'text/html; charset=utf-8',
	'.css':  'text/css; charset=utf-8',
	'.js':   'application/javascript; charset=utf-8',
	'.mjs':  'application/javascript; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.svg':  'image/svg+xml',
	'.png':  'image/png',
	'.jpg':  'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif':  'image/gif',
	'.webp': 'image/webp',
	'.ico':  'image/x-icon',
	'.txt':  'text/plain; charset=utf-8',
	'.wasm': 'application/wasm',
}

const INDEX_ALIASES = new Set(['', '/', '/index', '/index.html'])

async function resolveTarget(root: string, urlPath: string): Promise<string | null> {
	const decoded = decodeURIComponent(urlPath.split('?')[0]!.split('#')[0]!)

	if (INDEX_ALIASES.has(decoded)) {
		const idx = join(root, 'index.html')
		const si = await stat(idx).catch(() => null)
		return si?.isFile() ? idx : null
	}

	const candidate = resolve(root, '.' + decoded)
	const rootWithSep = root.endsWith(sep) ? root : root + sep
	if (candidate !== root && !candidate.startsWith(rootWithSep)) return null

	try {
		const s = await stat(candidate)
		if (s.isFile()) return candidate
		if (s.isDirectory()) {
			const idx = join(candidate, 'index.html')
			const si = await stat(idx).catch(() => null)
			if (si?.isFile()) return idx
		}
	} catch {
		// fallthrough
	}

	const withHtml = candidate + '.html'
	const sh = await stat(withHtml).catch(() => null)
	if (sh?.isFile()) return withHtml

	return null
}

interface PrintUrl { label: string; url: string }

function collectUrls(host: string, port: number): PrintUrl[] {
	const isWildcard = host === '0.0.0.0' || host === '::' || host === ''
	const isLoopback = host === 'localhost' || host === '127.0.0.1' || host === '::1'
	const urls: PrintUrl[] = []

	if (isWildcard || isLoopback) {
		urls.push({ label: 'Local', url: `http://localhost:${port}` })
	} else {
		urls.push({ label: 'Local', url: `http://${host}:${port}` })
	}

	if (isWildcard) {
		const ifaces = networkInterfaces()
		for (const list of Object.values(ifaces)) {
			if (!list) continue
			for (const ni of list) {
				if (ni.family !== 'IPv4' || ni.internal) continue
				urls.push({ label: 'Network', url: `http://${ni.address}:${port}` })
			}
		}
		if (urls.length === 1) {
			urls.push({ label: 'Network', url: 'use --host to expose' })
		}
	}

	return urls
}

function listenWithFallback(server: Server, startPort: number, host: string): Promise<number> {
	return new Promise((resolveListen, rejectListen) => {
		let current = startPort
		let tried = 0
		const attempt = () => {
			const onError = (err: NodeJS.ErrnoException) => {
				if (err.code !== 'EADDRINUSE') {
					rejectListen(err)
					return
				}
				log.warn(`port ${current} in use, trying ${current + 1}`)
				current++
				tried++
				if (current > 65535 || tried > MAX_PORT_RETRIES) {
					rejectListen(new Error(`no available port after ${tried} attempts (last tried ${current - 1})`))
					return
				}
				setImmediate(attempt)
			}
			server.once('error', onError)
			server.listen(current, host, () => {
				server.removeListener('error', onError)
				resolveListen(current)
			})
		}
		attempt()
	})
}

async function main() {
	const { dir, port, host } = parseArgs(process.argv.slice(2))

	const rootStat = await stat(dir).catch(() => null)
	if (!rootStat?.isDirectory()) {
		log.error(`not a directory: ${dir}`)
		process.exit(1)
	}

	const server = createServer(async (req, res) => {
		const urlPath = req.url ?? '/'
		const target = await resolveTarget(dir, urlPath)

		if (!target) {
			log.warn(`404 ${req.method} ${urlPath}`)
			res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
			res.end('Not Found')
			return
		}

		try {
			const data = await readFile(target)
			const type = MIME[extname(target).toLowerCase()] ?? 'application/octet-stream'
			res.writeHead(200, { 'content-type': type, 'content-length': data.length })
			res.end(data)
			log.info(`200 ${req.method} ${urlPath} -> ${target}`)
		} catch (err) {
			log.error(`500 ${req.method} ${urlPath}`, err)
			res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
			res.end('Internal Server Error')
		}
	})

	let actualPort: number
	try {
		actualPort = await listenWithFallback(server, port, host)
	} catch (err) {
		log.error(`failed to listen on ${host}:${port}`, err)
		process.exit(1)
	}
	log.log(`serving ${dir}`)
	for (const { label, url } of collectUrls(host, actualPort)) {
		log.log(`${label.padEnd(7)} ${url}`)
	}

	const shutdown = () => {
		log.log('shutting down')
		server.close(() => process.exit(0))
	}
	process.on('SIGINT', shutdown)
	process.on('SIGTERM', shutdown)
}

main()
