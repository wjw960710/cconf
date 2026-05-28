/**
 * @param {string} prefix
 * @returns {import('./log.js').Logger}
 */
export function createLogger(prefix) {
	const tag = `[${prefix}]`
	return {
		log: (...args) => console.log(tag, ...args),
		error: (...args) => console.error(tag, ...args),
		warn: (...args) => console.warn(tag, ...args),
		info: (...args) => console.info(tag, ...args),
	}
}
