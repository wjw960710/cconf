import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { EXIT_NO_NEW_COMMITS } from '../lib/exit-codes.js'
import { createLogger } from '../lib/log.js'

const log = createLogger('update')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const isWin = process.platform === 'win32'

function run(cmd: string, args: string[]) {
	return spawnSync(cmd, args, {
		cwd: root,
		stdio: 'inherit',
		shell: isWin,
	})
}

const pullRes = run('tsx', ['scripts/cli/git-pull.ts'])
if (pullRes.error) {
	log.error(`failed to run git-pull (${pullRes.error.message})`)
	process.exit(1)
}
if (pullRes.status === EXIT_NO_NEW_COMMITS) {
	log.log('no new commits, skip deps & deploy')
	process.exit(0)
}
if (pullRes.status !== 0) {
	process.exit(pullRes.status ?? 1)
}

const depsRes = run('pnpm', ['run', 'deps'])
if (depsRes.error) {
	log.error(`failed to run deps (${depsRes.error.message})`)
	process.exit(1)
}
if (depsRes.status !== 0) {
	process.exit(depsRes.status)
}

const deployRes = run('pnpm', ['run', 'deploy'])
if (deployRes.error) {
	log.error(`failed to run deploy (${deployRes.error.message})`)
	process.exit(1)
}
process.exit(deployRes.status ?? 0)
