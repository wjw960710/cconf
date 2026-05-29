import { createServer as createHttpServer } from 'node:http'
import { createServer as createHttpsServer } from 'node:https'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Server } from 'node:net'
import type { Duplex } from 'node:stream'
import { readFile, stat } from 'node:fs/promises'
import { networkInterfaces } from 'node:os'
import { extname, isAbsolute, join, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

import httpProxy from 'http-proxy-3'
import selfsigned from 'selfsigned'

import { loadEnv } from '../lib/env.js'
import { createLogger } from '../lib/log.js'

loadEnv({ prefix: 'serve' })

const log = createLogger('serve')

const FALLBACK_HOST = 'localhost'
const FALLBACK_PORT = 11737
const MAX_PORT_RETRIES = 100

const CONFIG_FILE_NAMES = [
	'serve.config.ts',
	'serve.config.mts',
	'serve.config.js',
	'serve.config.mjs',
	'serve.config.cjs',
	'serve.config.json',
]

export interface ServeProxyRewrite {
	from: string
	to: string
}

export interface ServeProxyEntry {
	target: string
	changeOrigin?: boolean
	secure?: boolean
	ws?: boolean
	rewrite?: ((path: string) => string) | ServeProxyRewrite
	headers?: Record<string, string>
}

export type ServeProxyValue = string | ServeProxyEntry

export interface ServeConfig {
	proxy?: Record<string, ServeProxyValue>
}

interface NormalizedProxyRule {
	key: string
	matcher: RegExp | string
	isRegex: boolean
	entry: ServeProxyEntry
}

interface Options {
	dir: string
	port: number
	host: string
	https: boolean
	cert?: string
	key?: string
	configPath?: string
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
	console.error('Usage: ccf serve [dir] [--port=N] [--host=H] [--https] [--cert=PATH --key=PATH]')
	console.error('  [dir]         欲提供服務的目錄（預設：當前目錄）')
	console.error('  --port, -p    監聽 port（預設：11737）')
	console.error('  --host, -h    監聽 host（預設：localhost）')
	console.error('  --https       啟用 HTTPS（預設自動產生 self-signed 憑證）')
	console.error('  --cert        憑證檔案路徑（搭配 --https 使用，需同時帶 --key）')
	console.error('  --key         私鑰檔案路徑（搭配 --https 使用，需同時帶 --cert）')
	process.exit(1)
}

function parseArgs(argv: string[]): Options {
	let dir: string | undefined
	let port = envPort()
	let host = envHost()
	let https = false
	let cert: string | undefined
	let key: string | undefined

	const userCwd = process.env.CLI_SERVE_USER_CWD ?? process.cwd()
	const resolveUserPath = (p: string) => isAbsolute(p) ? resolve(p) : resolve(userCwd, p)

	for (let i = 0; i < argv.length; i++) {
		const a = argv[i]!
		if (a === '--help' || a === '-?') usage()

		const eq = a.indexOf('=')
		const key2 = eq >= 0 ? a.slice(0, eq) : a
		const inlineVal = eq >= 0 ? a.slice(eq + 1) : undefined
		const takeVal = (): string => {
			if (inlineVal !== undefined) return inlineVal
			const v = argv[++i]
			if (v === undefined) usage()
			return v
		}

		if (key2 === '--port' || key2 === '-p') {
			const n = Number(takeVal())
			if (!Number.isInteger(n) || n <= 0 || n > 65535) usage()
			port = n
		} else if (key2 === '--host' || key2 === '-h') {
			host = takeVal()
		} else if (key2 === '--https') {
			if (inlineVal !== undefined) usage()
			https = true
		} else if (key2 === '--cert') {
			cert = resolveUserPath(takeVal())
		} else if (key2 === '--key') {
			key = resolveUserPath(takeVal())
		} else if (a.startsWith('-')) {
			usage()
		} else if (dir === undefined) {
			dir = a
		} else {
			usage()
		}
	}

	if ((cert && !key) || (!cert && key)) {
		log.error('--cert and --key must be provided together')
		process.exit(1)
	}
	if ((cert || key) && !https) {
		log.error('--cert / --key require --https')
		process.exit(1)
	}

	const resolvedDir = dir === undefined
		? userCwd
		: (isAbsolute(dir) ? resolve(dir) : resolve(userCwd, dir))

	return { dir: resolvedDir, port, host, https, cert, key }
}

async function discoverConfigPath(searchDirs: string[]): Promise<string | undefined> {
	const seen = new Set<string>()
	for (const dir of searchDirs) {
		if (seen.has(dir)) continue
		seen.add(dir)
		for (const name of CONFIG_FILE_NAMES) {
			const p = join(dir, name)
			const s = await stat(p).catch(() => null)
			if (s?.isFile()) return p
		}
	}
	return undefined
}

async function loadConfig(path: string): Promise<ServeConfig> {
	const ext = extname(path).toLowerCase()
	if (ext === '.json') {
		const text = await readFile(path, 'utf8')
		return JSON.parse(text) as ServeConfig
	}
	const mod = await import(pathToFileURL(path).href)
	const cfg = (mod.default ?? mod) as ServeConfig
	if (!cfg || typeof cfg !== 'object') {
		throw new Error(`config file did not export a config object: ${path}`)
	}
	return cfg
}

function normalizeProxyEntry(value: ServeProxyValue): ServeProxyEntry {
	if (typeof value === 'string') return { target: value }
	if (!value || typeof value.target !== 'string' || !value.target) {
		throw new Error(`proxy entry missing target: ${JSON.stringify(value)}`)
	}
	return value
}

function normalizeProxyRules(proxy: Record<string, ServeProxyValue> | undefined): NormalizedProxyRule[] {
	if (!proxy) return []
	const rules: NormalizedProxyRule[] = []
	for (const [key, value] of Object.entries(proxy)) {
		const entry = normalizeProxyEntry(value)
		const isRegex = key.startsWith('^')
		rules.push({
			key,
			matcher: isRegex ? new RegExp(key) : key,
			isRegex,
			entry,
		})
	}
	return rules
}

function matchProxyRule(rules: NormalizedProxyRule[], urlPath: string): NormalizedProxyRule | undefined {
	for (const rule of rules) {
		if (rule.isRegex) {
			if ((rule.matcher as RegExp).test(urlPath)) return rule
		} else {
			if (urlPath.startsWith(rule.matcher as string)) return rule
		}
	}
	return undefined
}

function applyRewrite(urlPath: string, entry: ServeProxyEntry): string {
	const { rewrite } = entry
	if (!rewrite) return urlPath
	if (typeof rewrite === 'function') return rewrite(urlPath)
	return urlPath.replace(new RegExp(rewrite.from), rewrite.to)
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

function collectUrls(host: string, port: number, scheme: 'http' | 'https'): PrintUrl[] {
	const isWildcard = host === '0.0.0.0' || host === '::' || host === ''
	const isLoopback = host === 'localhost' || host === '127.0.0.1' || host === '::1'
	const urls: PrintUrl[] = []

	if (isWildcard || isLoopback) {
		urls.push({ label: 'Local', url: `${scheme}://localhost:${port}` })
	} else {
		urls.push({ label: 'Local', url: `${scheme}://${host}:${port}` })
	}

	if (isWildcard) {
		const ifaces = networkInterfaces()
		for (const list of Object.values(ifaces)) {
			if (!list) continue
			for (const ni of list) {
				if (ni.family !== 'IPv4' || ni.internal) continue
				urls.push({ label: 'Network', url: `${scheme}://${ni.address}:${port}` })
			}
		}
		if (urls.length === 1) {
			urls.push({ label: 'Network', url: 'use --host to expose' })
		}
	}

	return urls
}

async function loadTls(opts: Options): Promise<{ cert: string | Buffer; key: string | Buffer }> {
	if (opts.cert && opts.key) {
		const [certBuf, keyBuf] = await Promise.all([
			readFile(opts.cert),
			readFile(opts.key),
		])
		log.info(`loaded TLS cert: ${opts.cert}`)
		log.info(`loaded TLS key:  ${opts.key}`)
		return { cert: certBuf, key: keyBuf }
	}
	const cn = opts.host || 'localhost'
	const attrs = [{ name: 'commonName', value: cn }]
	// 現代 TLS client（Node 19+、Chrome、Firefox）忽略 CN，必須帶 subjectAltName 才會被接受
	const altNames: Array<{ type: number; value?: string; ip?: string }> = [
		{ type: 2, value: 'localhost' },
		{ type: 7, ip: '127.0.0.1' },
		{ type: 7, ip: '::1' },
	]
	if (cn !== 'localhost' && cn !== '127.0.0.1' && cn !== '::1' && cn !== '0.0.0.0' && cn !== '') {
		altNames.push(/^[\d.]+$/.test(cn) ? { type: 7, ip: cn } : { type: 2, value: cn })
	}
	const pems = await selfsigned.generate(attrs, {
		algorithm: 'sha256',
		keySize: 2048,
		extensions: [
			{ name: 'basicConstraints', cA: false },
			{ name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
			{ name: 'extKeyUsage', serverAuth: true },
			{ name: 'subjectAltName', altNames },
		],
	})
	log.info(`generated self-signed TLS cert (CN=${cn}, 365d)`)
	return { cert: pems.cert, key: pems.private }
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
	const opts = parseArgs(process.argv.slice(2))
	const { dir, port, host, https } = opts

	const rootStat = await stat(dir).catch(() => null)
	if (!rootStat?.isDirectory()) {
		log.error(`not a directory: ${dir}`)
		process.exit(1)
	}

	const userCwd = process.env.CLI_SERVE_USER_CWD ?? process.cwd()
	const configPath = await discoverConfigPath([userCwd, dir])
	let proxyRules: NormalizedProxyRule[] = []
	let proxy: ReturnType<typeof httpProxy.createProxyServer> | undefined
	let hasWs = false

	if (configPath) {
		try {
			const cfg = await loadConfig(configPath)
			proxyRules = normalizeProxyRules(cfg.proxy)
			log.info(`loaded config: ${configPath}`)
		} catch (err) {
			log.error(`failed to load config ${configPath}:`, err)
			process.exit(1)
		}
	}

	if (proxyRules.length) {
		proxy = httpProxy.createProxyServer()
		hasWs = proxyRules.some(r => r.entry.ws)
		proxy.on('error', (err: unknown, _req, res) => {
			const msg = err instanceof Error ? err.message : String(err)
			log.error(`proxy error: ${msg}`)
			if (res && 'writeHead' in res) {
				const r = res as ServerResponse
				if (!r.headersSent) {
					r.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' })
				}
				r.end('Bad Gateway')
			} else if (res) {
				;(res as Duplex).destroy()
			}
		})
		for (const rule of proxyRules) {
			const flags: string[] = []
			if (rule.entry.changeOrigin) flags.push('changeOrigin')
			if (rule.entry.ws) flags.push('ws')
			if (rule.entry.secure === false) flags.push('insecure')
			if (rule.entry.rewrite) flags.push('rewrite')
			log.info(`proxy ${rule.key} -> ${rule.entry.target}${flags.length ? ` [${flags.join(',')}]` : ''}`)
		}
	}

	const handler = async (req: IncomingMessage, res: ServerResponse) => {
		const urlPath = req.url ?? '/'

		if (proxy && proxyRules.length) {
			const match = matchProxyRule(proxyRules, urlPath)
			if (match) {
				const rewritten = applyRewrite(urlPath, match.entry)
				req.url = rewritten
				log.info(`proxy ${req.method} ${urlPath} -> ${match.entry.target}${rewritten !== urlPath ? rewritten : ''}`)
				proxy.web(req, res, {
					target: match.entry.target,
					changeOrigin: match.entry.changeOrigin ?? false,
					secure: match.entry.secure ?? true,
					headers: match.entry.headers,
					ws: match.entry.ws ?? false,
				})
				return
			}
		}

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
	}

	let server: Server
	if (https) {
		const tls = await loadTls(opts)
		server = createHttpsServer(tls, handler)
	} else {
		server = createHttpServer(handler)
	}

	if (proxy && hasWs) {
		server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
			const urlPath = req.url ?? '/'
			const match = matchProxyRule(proxyRules, urlPath)
			if (!match || !match.entry.ws) {
				socket.destroy()
				return
			}
			const rewritten = applyRewrite(urlPath, match.entry)
			req.url = rewritten
			log.info(`proxy ws ${urlPath} -> ${match.entry.target}${rewritten !== urlPath ? rewritten : ''}`)
			proxy!.ws(req, socket, head, {
				target: match.entry.target,
				changeOrigin: match.entry.changeOrigin ?? false,
				secure: match.entry.secure ?? true,
				headers: match.entry.headers,
			})
		})
	}

	let actualPort: number
	try {
		actualPort = await listenWithFallback(server, port, host)
	} catch (err) {
		log.error(`failed to listen on ${host}:${port}`, err)
		process.exit(1)
	}
	log.log(`serving ${dir}`)
	for (const { label, url } of collectUrls(host, actualPort, https ? 'https' : 'http')) {
		log.log(`${label.padEnd(7)} ${url}`)
	}

	const shutdown = () => {
		log.log('shutting down')
		proxy?.close()
		server.close(() => process.exit(0))
	}
	process.on('SIGINT', shutdown)
	process.on('SIGTERM', shutdown)
}

main()
