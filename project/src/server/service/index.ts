import { GlobalLogger, Logger } from '../helper/Logger';
import { ServiceStatus, ServiceConfig } from './data';

export abstract class BaseService {
	public abstract readonly serviceIdentifier: string;
	public abstract readonly config: ServiceConfig;

	public _status: ServiceStatus = ServiceStatus.DISABLED;
	public _lastError: Error | null = null;
	private _startTime: number | null = null;

	// Abstrakte Methoden für Implementierung
	protected abstract onServiceEnable(): Promise<void>;
	protected abstract onServiceDisable(): Promise<void>;
	protected abstract onHealthCheck(): Promise<boolean>;

	public get status(): ServiceStatus {
		return this._status;
	}

	public get uptime(): number {
		return this._startTime ? Date.now() - this._startTime : 0;
	}

	public get isHealthy(): boolean {
		return this.status === ServiceStatus.ENABLED && !this._lastError;
	}
	// Interne Enable-Methode
	public async onEnable(): Promise<void> {
		if (this._status !== ServiceStatus.DISABLED) {
			throw new Error(`[AntiCheat][${this.serviceIdentifier}] this service couldnt be Started because it is already enabled!`);
		}

		this._status = ServiceStatus.ENABLING;
		this._lastError = null;

		try {
			await this.withTimeout(this.onServiceEnable(), this.config.timeout, `Service ${this.serviceIdentifier} enable timeout`);
			this._status = ServiceStatus.ENABLED;
			this._startTime = Date.now();
		} catch (error) {
			this._status = ServiceStatus.ERROR;
			this._lastError = error instanceof Error ? error : new Error(String(error));
			GlobalLogger.error(`[AntiCheat][${this.serviceIdentifier}] Service couldnt be enabled!`, { error: this._lastError });
		}
	}
	// Interne Disable-Methode
	public async onDisable(): Promise<void> {
		if (this._status === ServiceStatus.DISABLED) {
			return;
		}

		this._status = ServiceStatus.DISABLING;

		try {
			await this.withTimeout(this.onServiceDisable(), this.config.timeout, `Service ${this.serviceIdentifier} disable timeout`);
		} catch (error) {
			this._lastError = error instanceof Error ? error : new Error(String(error));
			throw error;
		} finally {
			this._status = ServiceStatus.DISABLED;
			this._startTime = null;
		}
	}

	// Health Check mit Timeout
	public async healthCheck(): Promise<boolean> {
		if (this._status !== ServiceStatus.ENABLED) {
			return false;
		}

		try {
			return await this.withTimeout(
				this.onHealthCheck(),
				5000, // 5s Health Check Timeout
				`Health check timeout for ${this.serviceIdentifier}`
			);
		} catch (error) {
			this._lastError = error instanceof Error ? error : new Error(String(error));
			return false;
		}
	}

	// Timeout-Hilfsmethode
	private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
		const timeoutPromise = new Promise<never>((_, reject) => {
			setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
		});

		return Promise.race([promise, timeoutPromise]);
	}
}
