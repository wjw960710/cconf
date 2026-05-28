export interface Logger {
	log: (...args: unknown[]) => void
	error: (...args: unknown[]) => void
	warn: (...args: unknown[]) => void
	info: (...args: unknown[]) => void
}

export function createLogger(prefix: string): Logger
