import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv } from '../lib/env.js'
import { EXIT_NO_NEW_COMMITS } from '../lib/exit-codes.js'
import { createLogger } from '../lib/log.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

loadEnv({ prefix: 'git-pull' })

const log = createLogger('git-pull')

const token = process.env.GIT_TOKEN?.trim()
if (!token) {
	log.log('GIT_TOKEN not set, skip')
	process.exit(0)
}

function git(args: string[], opts: { capture?: boolean } = {}) {
	return spawnSync('git', args, {
		cwd: root,
		stdio: opts.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
		encoding: 'utf8',
		// 關掉 helper + 不准互動，避免彈窗或 hang
		env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
	})
}

const remoteRes = git(['config', '--get', 'remote.origin.url'], { capture: true })
if (remoteRes.status !== 0 || !remoteRes.stdout?.trim()) {
	log.log('cannot read remote.origin.url, skip')
	process.exit(0)
}
const remoteUrl = remoteRes.stdout.trim()

let authedUrl: string
try {
	const u = new URL(remoteUrl)
	if (u.protocol !== 'https:' && u.protocol !== 'http:') {
		log.log(`remote is not http(s) (${u.protocol}), skip`)
		process.exit(0)
	}
	u.username = 'oauth2'
	u.password = encodeURIComponent(token)
	authedUrl = u.toString()
} catch {
	log.log(`invalid remote url: ${remoteUrl}, skip`)
	process.exit(0)
}

const branchRes = git(['rev-parse', '--abbrev-ref', 'HEAD'], { capture: true })
if (branchRes.status !== 0 || !branchRes.stdout?.trim()) {
	log.log('cannot detect current branch, skip')
	process.exit(0)
}
const branch = branchRes.stdout.trim()

const beforeRes = git(['rev-parse', 'HEAD'], { capture: true })
if (beforeRes.status !== 0 || !beforeRes.stdout?.trim()) {
	log.log('cannot read HEAD, skip')
	process.exit(0)
}
const beforeSha = beforeRes.stdout.trim()

const pullRes = git(['-c', 'credential.helper=', 'pull', authedUrl, branch])
if (pullRes.error) {
	log.log(`failed to run git (${pullRes.error.message}), skip`)
	process.exit(0)
}
if (pullRes.status !== 0) {
	log.log(`pull failed with exit ${pullRes.status}, skip`)
	process.exit(0)
}

const afterRes = git(['rev-parse', 'HEAD'], { capture: true })
const afterSha = afterRes.stdout?.trim()
if (afterRes.status !== 0 || !afterSha) {
	log.log('cannot read HEAD after pull')
	process.exit(0)
}
if (afterSha === beforeSha) {
	log.log('no new commits')
	process.exit(EXIT_NO_NEW_COMMITS)
}

log.log('new commits pulled')
process.exit(0)
