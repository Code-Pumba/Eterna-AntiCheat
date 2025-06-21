import { bootstrap } from '..';
import { Bootstrap } from '../bootstrap';
import { GlobalLogger, Logger } from '../helper/Logger';
import { ServiceStatus, ServiceConfig } from './data';
import { ServiceManager } from './manager';

export abstract class BaseService {
	public abstract readonly serviceIdentifier: string;
	public abstract readonly config: ServiceConfig;

	// Getting Bootstrap Class at the Beginning to reduce the amount of calls
	private bootstrap: Bootstrap = bootstrap;

	public _status: ServiceStatus = ServiceStatus.DISABLED;
	public _lastError: Error | null = null;
	private _startTime: number | null = null;

	/**
	 * Abstract methods
	 */
	protected abstract onServiceEnable(): Promise<void>;
	protected abstract onServiceDisable(): Promise<void>;
	protected abstract onHealthCheck(): Promise<boolean>;

	public get status(): ServiceStatus {
		return this._status;
	}

	public get serviceManager(): ServiceManager {
		return this.bootstrap.getServiceManager();
	}

	public get uptime(): number {
		return this._startTime ? Date.now() - this._startTime : 0;
	}

	public get isHealthy(): boolean {
		return this.status === ServiceStatus.ENABLED && !this._lastError;
	}
	/**
	 * Internal Methods to Enable or Disable the Service
	 */
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

	/**
	 * Internal Methods to Enable or Disable the Service
	 */
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

	/**
	 * Checks if the given Service is healthy
	 * @returns {Promise<boolean>}
	 */
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

	/**
	 * Method to run a promise with a timeout
	 * @param promise
	 * @param timeoutMs
	 * @param timeoutMessage
	 * @returns
	 */
	private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
		const timeoutPromise = new Promise<never>((_, reject) => {
			setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
		});

		return Promise.race([promise, timeoutPromise]);
	}
}
