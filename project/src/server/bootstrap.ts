import { PlayerConnectController } from './controller/Connect/playerConnectController';
import { ControllerManager } from './controller/manager';
import { Logger } from './helper/Logger';
import { LoggerFactory } from './helper/Logger/factory';
import { sleep } from './helper/utils';
import { BaseService } from './service';
import { DatabaseService } from './service/Database';
import { ServiceManager } from './service/manager';
import { MonitoringService } from './service/Monitoring';
import { Resources } from './service/Monitoring/resources';

export interface IBoot {
	/**
	 * Registers a Service into the Application
	 * @param service
	 */
	registerService(service: any): void;
	/**
	 *
	 * @param controller
	 */
	registerController(controller: any): void;
	/**
	 * Initialize AntiCheat
	 */
	initializeAntiCheat(): Promise<boolean>;
	/**
	 * Destroy AntiCheat
	 */
	destroyAntiCheat(): Promise<void>;

	// Getter
	/**
	 * Returns the ServiceManager
	 * @returns {ServiceManager}
	 */
	getServiceManager(): ServiceManager;
	/**
	 * Returns the ControllerManager
	 * @returns {Error}
	 */
	getControllerManager(): ControllerManager;
}

export class Bootstrap implements IBoot {
	private serviceManager: ServiceManager;
	private controllerManager: ControllerManager;

	private readonly logger: Logger;

	private initialized: boolean = false;

	constructor() {
		this.logger = LoggerFactory.create('bootstrap');
		this.serviceManager = new ServiceManager();
		this.controllerManager = new ControllerManager();
	}

	public async registerService(): Promise<boolean> {
		try {
			// Here are all the Services to be registered
			const promise = [this.serviceManager.register(new DatabaseService()), this.serviceManager.register(new MonitoringService()), this.serviceManager.register(new Resources())];

			await Promise.allSettled(promise);
			await this.serviceManager.start();
			return true;
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error));
			this.logger.error('Error while registering services:', err);
			return false;
		}
	}

	public async registerController(controller: any): Promise<boolean> {
		try {
			// Here are all the Controller to be registered
			const promise = [this.controllerManager.registerController(new PlayerConnectController())];

			await Promise.allSettled(promise);
			await this.controllerManager.startAll();
			return true;
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error));
			this.logger.error('Error while registering services:', err);
			return false;
		}
	}

	public async initializeAntiCheat(): Promise<boolean> {
		try {
			const servicesRegistered = await this.registerService();
			if (!servicesRegistered) {
				throw new Error('Failed to register services');
			}

			// Wait for Services to be ready
			await sleep(2500);

			const controllersRegistered = await this.registerController(null);
			if (!controllersRegistered) {
				throw new Error('Failed to register controllers');
			}

			this.initialized = true;

			return true;
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error));
			this.logger.error('Error while registering services:', err);
			return false;
		}
	}

	public get isReady(): boolean {
		return this.initialized;
	}

	public destroyAntiCheat(): Promise<void> {
		throw new Error('Method not implemented.');
	}

	public getServiceManager(): ServiceManager {
		return this.serviceManager;
	}

	public getControllerManager(): ControllerManager {
		return this.controllerManager;
	}
}
