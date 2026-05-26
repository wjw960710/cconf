export interface LoadEnvOptions {
	/** 載入時的日誌前綴（例：`build-claude`），未提供則靜默載入 */
	prefix?: string
	/** 模式名稱（例：`development` / `production` / `test`），提供時啟用四層讀取 */
	mode?: string
}

export function loadEnv(options?: LoadEnvOptions): void
