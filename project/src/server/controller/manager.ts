import { BaseController } from '.';
import { Logger } from '../helper/Logger';
import { LoggerFactory } from '../helper/Logger/factory';
import { ControllerManagerOptions, ControllerStatus } from './data';

export class ControllerManager {
	private controllers: Map<string, BaseController> = new Map();
	private healthCheckInterval?: NodeJS.Timeout;
	private options: ControllerManagerOptions;

	private readonly logger: Logger;

	constructor(options: ControllerManagerOptions = {}) {
		this.options = {
			autoStart: false,
			startTimeout: 10000,
			healthCheckInterval: 30000, // 30s
			maxRetries: 3,
			...options,
		};

		this.logger = LoggerFactory.create('controller-manager');

		// Auto health checks
		if (this.options.healthCheckInterval) {
			this.startHealthCheckLoop();
		}
	}

	public async registerController(controller: BaseController, autoStart?: boolean): Promise<void> {
		if (this.controllers.has(controller.controllerIdentifier)) {
			throw new Error(`Controller ${controller.controllerIdentifier} is already registered`);
		}

		try {
			this.controllers.set(controller.controllerIdentifier, controller);

			const shouldStart = autoStart ?? this.options.autoStart;
			if (shouldStart) {
				await this.startController(controller.controllerIdentifier);
			}

			this.logger.info(`Controller ${controller.controllerIdentifier} registered successfully`);
		} catch (error) {
			this.controllers.delete(controller.controllerIdentifier);
			throw new Error(`Failed to register controller ${controller.controllerIdentifier}: ${error}`);
		}
	}

	public async registerControllers(controllers: BaseController[], autoStart?: boolean): Promise<void> {
		const promises = controllers.map((controller) => this.registerController(controller, autoStart));

		await Promise.allSettled(promises);
	}

	public async startController(identifier: string): Promise<void> {
		const controller = this.controllers.get(identifier);
		if (!controller) {
			throw new Error(`Controller ${identifier} not found`);
		}

		if (controller.status === ControllerStatus.ENABLED) {
			this.logger.info(`Controller ${identifier} is already running`);
			return;
		}

		try {
			await this.withTimeout(controller.enable(), this.options.startTimeout!, `Timeout starting controller ${identifier}`);
			this.logger.info(`Controller ${identifier} started successfully`);
		} catch (error) {
			throw new Error(`Failed to start controller ${identifier}: ${error}`);
		}
	}

	public async stopController(identifier: string): Promise<void> {
		const controller = this.controllers.get(identifier);
		if (!controller) {
			throw new Error(`Controller ${identifier} not found`);
		}

		if (controller.status === ControllerStatus.DISABLED) {
			this.logger.info(`Controller ${identifier} is already stopped`);
			return;
		}

		try {
			await controller.disable();
			this.logger.info(`Controller ${identifier} stopped successfully`);
		} catch (error) {
			throw new Error(`Failed to stop controller ${identifier}: ${error}`);
		}
	}

	public async startAll(): Promise<void> {
		const results = await Promise.allSettled(Array.from(this.controllers.keys()).map((id) => this.startController(id)));

		const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected').map((result) => result.reason);

		if (failures.length > 0) {
			this.logger.warning(`Some controllers failed to start:`, failures);
		}

		this.logger.info(`Started ${results.length - failures.length}/${results.length} controllers`);
	}

	public async stopAll(): Promise<void> {
		const results = await Promise.allSettled(Array.from(this.controllers.keys()).map((id) => this.stopController(id)));

		const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected').map((result) => result.reason);

		if (failures.length > 0) {
			this.logger.warning(`Some controllers failed to stop:`, failures);
		}

		this.logger.info(`Stopped ${results.length - failures.length}/${results.length} controllers`);
	}

	public async unregisterController(identifier: string): Promise<void> {
		const controller = this.controllers.get(identifier);
		if (!controller) {
			throw new Error(`Controller ${identifier} not found`);
		}

		if (controller.status !== ControllerStatus.DISABLED) {
			await this.stopController(identifier);
		}

		this.controllers.delete(identifier);
		this.logger.info(`Controller ${identifier} unregistered`);
	}

	public getController(identifier: string): BaseController | undefined {
		return this.controllers.get(identifier);
	}

	public getAllControllers(): BaseController[] {
		return Array.from(this.controllers.values());
	}

	public getStatus(): { [key: string]: { status: ControllerStatus; uptime: number; healthy: boolean } } {
		const status: { [key: string]: { status: ControllerStatus; uptime: number; healthy: boolean } } = {};

		for (const [id, controller] of this.controllers) {
			status[id] = {
				status: controller.status,
				uptime: controller.uptime,
				healthy: controller.isHealthy,
			};
		}

		return status;
	}

	public async performHealthCheck(): Promise<{ [key: string]: boolean }> {
		const results: { [key: string]: boolean } = {};

		const promises = Array.from(this.controllers.entries()).map(async ([id, controller]) => {
			try {
				results[id] = await controller.healthCheck();
			} catch (error) {
				this.logger.error(`Health check failed for controller ${id}:`, error);
				results[id] = false;
			}
		});

		await Promise.allSettled(promises);
		return results;
	}

	private startHealthCheckLoop(): void {
		if (this.healthCheckInterval) {
			return;
		}

		this.healthCheckInterval = setInterval(async () => {
			try {
				const results = await this.performHealthCheck();
				const unhealthyControllers = Object.entries(results)
					.filter(([_, healthy]) => !healthy)
					.map(([id]) => id);

				if (unhealthyControllers.length > 0) {
					this.logger.warning('Unhealthy controllers detected:', unhealthyControllers);
				}
			} catch (error) {
				this.logger.error('Health check loop error:', error);
			}
		}, this.options.healthCheckInterval);
	}

	private stopHealthCheckLoop(): void {
		if (this.healthCheckInterval) {
			clearInterval(this.healthCheckInterval);
			this.healthCheckInterval = undefined;
		}
	}

	public async restartController(identifier: string, maxRetries: number = this.options.maxRetries!): Promise<void> {
		const controller = this.controllers.get(identifier);
		if (!controller) {
			throw new Error(`Controller ${identifier} not found`);
		}

		let attempt = 0;
		let lastError: Error | null = null;

		while (attempt < maxRetries) {
			try {
				await this.stopController(identifier);
				await new Promise((resolve) => setTimeout(resolve, 1000)); // 1s Pause
				await this.startController(identifier);
				this.logger.info(`Controller ${identifier} restarted successfully after ${attempt + 1} attempts`);
				return;
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));
				attempt++;
				this.logger.warning(`Restart attempt ${attempt}/${maxRetries} failed for ${identifier}:`, error);

				if (attempt < maxRetries) {
					await new Promise((resolve) => setTimeout(resolve, 2000 * attempt)); // Exponential backoff
				}
			}
		}

		throw new Error(`Failed to restart controller ${identifier} after ${maxRetries} attempts. Last error: ${lastError?.message}`);
	}

	public async shutdown(): Promise<void> {
		this.logger.info('Shutting down ControllerManager...');

		this.stopHealthCheckLoop();
		await this.stopAll();
		this.controllers.clear();

		this.logger.info('ControllerManager shutdown complete');
	}

	private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
		const timeoutPromise = new Promise<never>((_, reject) => {
			setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
		});
		return Promise.race([promise, timeoutPromise]);
	}
}
