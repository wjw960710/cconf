import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv } from './lib/env.js'
import { EXIT_NO_NEW_COMMITS } from './lib/exit-codes.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

loadEnv({ prefix: 'git-pull' })

const token = process.env.GIT_TOKEN?.trim()
if (!token) {
	console.log('[git-pull] GIT_TOKEN not set, skip')
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
	console.log('[git-pull] cannot read remote.origin.url, skip')
	process.exit(0)
}
const remoteUrl = remoteRes.stdout.trim()

let authedUrl: string
try {
	const u = new URL(remoteUrl)
	if (u.protocol !== 'https:' && u.protocol !== 'http:') {
		console.log(`[git-pull] remote is not http(s) (${u.protocol}), skip`)
		process.exit(0)
	}
	u.username = 'oauth2'
	u.password = encodeURIComponent(token)
	authedUrl = u.toString()
} catch {
	console.log(`[git-pull] invalid remote url: ${remoteUrl}, skip`)
	process.exit(0)
}

const branchRes = git(['rev-parse', '--abbrev-ref', 'HEAD'], { capture: true })
if (branchRes.status !== 0 || !branchRes.stdout?.trim()) {
	console.log('[git-pull] cannot detect current branch, skip')
	process.exit(0)
}
const branch = branchRes.stdout.trim()

const beforeRes = git(['rev-parse', 'HEAD'], { capture: true })
if (beforeRes.status !== 0 || !beforeRes.stdout?.trim()) {
	console.log('[git-pull] cannot read HEAD, skip')
	process.exit(0)
}
const beforeSha = beforeRes.stdout.trim()

const pullRes = git(['-c', 'credential.helper=', 'pull', authedUrl, branch])
if (pullRes.error) {
	console.log(`[git-pull] failed to run git (${pullRes.error.message}), skip`)
	process.exit(0)
}
if (pullRes.status !== 0) {
	console.log(`[git-pull] pull failed with exit ${pullRes.status}, skip`)
	process.exit(0)
}

const afterRes = git(['rev-parse', 'HEAD'], { capture: true })
const afterSha = afterRes.stdout?.trim()
if (afterRes.status !== 0 || !afterSha) {
	console.log('[git-pull] cannot read HEAD after pull')
	process.exit(0)
}
if (afterSha === beforeSha) {
	console.log('[git-pull] no new commits')
	process.exit(EXIT_NO_NEW_COMMITS)
}

console.log('[git-pull] new commits pulled')
process.exit(0)
