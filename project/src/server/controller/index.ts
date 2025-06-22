import { bootstrap } from '..';
import { ServiceManager } from '../service/manager';
import { ControllerConfig, ControllerStatus, ControllerType } from './data';

export abstract class BaseController {
	public abstract readonly controllerIdentifier: string;
	public abstract readonly config: ControllerConfig;
	public abstract readonly type: ControllerType;

	protected _status: ControllerStatus = ControllerStatus.DISABLED;
	protected _lastError: Error | null = null;
	protected _startTime: number | null = null;

	protected readonly _serviceManager: ServiceManager;

	protected eventName?: string;
	protected eventListener?: (...args: any[]) => void;

	protected loopInterval?: NodeJS.Timeout;

	constructor(eventName?: string) {
		this.eventName = eventName;
		this._serviceManager = bootstrap.getServiceManager();
	}

	public get status(): ControllerStatus {
		return this._status;
	}

	public get uptime(): number {
		return this._startTime ? Date.now() - this._startTime : 0;
	}

	public get serviceManager(): ServiceManager {
		return this._serviceManager;
	}

	public get isHealthy(): boolean {
		return this._status === ControllerStatus.ENABLED && !this._lastError;
	}

	protected abstract onControllerEnable(): Promise<void>;
	protected abstract onControllerDisable(): Promise<void>;
	protected abstract onHealthCheck(): Promise<boolean>;

	protected onEventHandler?(...args: any[]): Promise<void> | void;

	protected onLoopTick?(): Promise<void> | void;

	public async enable(): Promise<void> {
		if (this._status !== ControllerStatus.DISABLED) {
			throw new Error(`Controller ${this.controllerIdentifier} is already enabled or in transition`);
		}

		this._status = ControllerStatus.ENABLING;
		this._lastError = null;

		try {
			await this.withTimeout(this.onControllerEnable(), this.config.timeout, `Controller ${this.controllerIdentifier} enable timeout`);

			if ((this.type === ControllerType.EVENT || this.type === ControllerType.HYBRID) && this.eventName) {
				this.registerEventListener();
			}

			if ((this.type === ControllerType.LOOP || this.type === ControllerType.HYBRID) && this.config.loopInterval) {
				this.startLoop();
			}

			this._status = ControllerStatus.ENABLED;
			this._startTime = Date.now();
		} catch (error) {
			this._status = ControllerStatus.ERROR;
			this._lastError = error instanceof Error ? error : new Error(String(error));
			throw error;
		}
	}

	public async disable(): Promise<void> {
		if (this._status === ControllerStatus.DISABLED) {
			return;
		}

		this._status = ControllerStatus.DISABLING;

		try {
			this.unregisterEventListener();

			this.stopLoop();

			await this.withTimeout(this.onControllerDisable(), this.config.timeout, `Controller ${this.controllerIdentifier} disable timeout`);
		} catch (error) {
			this._lastError = error instanceof Error ? error : new Error(String(error));
			throw error;
		} finally {
			this._status = ControllerStatus.DISABLED;
			this._startTime = null;
		}
	}

	// Health Check
	public async healthCheck(): Promise<boolean> {
		if (this._status !== ControllerStatus.ENABLED) {
			return false;
		}

		try {
			return await this.withTimeout(this.onHealthCheck(), 5000, `Health check timeout for controller ${this.controllerIdentifier}`);
		} catch (error) {
			this._lastError = error instanceof Error ? error : new Error(String(error));
			return false;
		}
	}

	private registerEventListener(): void {
		if (!this.eventName || !this.onEventHandler) {
			return;
		}

		this.eventListener = async (...args: any[]) => {
			try {
				const result = this.onEventHandler!(...args);
				if (result instanceof Promise) {
					await result; // ← Hier fehlt das await!
				}
			} catch (error) {
				this._lastError = error instanceof Error ? error : new Error(String(error));
				console.error(`Event handler error in ${this.controllerIdentifier}:`, error);
			}
		};

		addEventListener(this.eventName, this.eventListener, true);
	}

	private unregisterEventListener(): void {
		if (this.eventName && this.eventListener) {
			removeEventListener(this.eventName, this.eventListener);
			this.eventListener = undefined;
		}
	}

	private startLoop(): void {
		if (!this.config.loopInterval || !this.onLoopTick) {
			return;
		}

		this.loopInterval = setInterval(async () => {
			try {
				const result = this.onLoopTick!();
				if (result instanceof Promise) {
					await result;
				}
			} catch (error) {
				this._lastError = error instanceof Error ? error : new Error(String(error));
				throw new Error(`Loop tick error in ${this.controllerIdentifier}:`, error);
			}
		}, this.config.loopInterval);
	}

	private stopLoop(): void {
		if (this.loopInterval) {
			clearInterval(this.loopInterval);
			this.loopInterval = undefined;
		}
	}

	// Timeout-Wrapper (from BaseService)
	private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
		const timeoutPromise = new Promise<never>((_, reject) => {
			setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
		});
		return Promise.race([promise, timeoutPromise]);
	}
}
