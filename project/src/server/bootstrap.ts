import { ControllerManager } from './controller/manager';
import { sleep } from './helper/utils';
import { BaseService } from './service';
import { DatabaseService } from './service/Database';
import { ServiceManager } from './service/manager';
import { MonitoringService } from './service/Monitoring';

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

	private initialized: boolean = false;

	constructor() {
		this.serviceManager = new ServiceManager();
		this.controllerManager = new ControllerManager();
	}

	public async registerService(service: BaseService) {
		if (this.serviceManager.getService(service.serviceIdentifier)) {
			throw new Error(`Service ${service.serviceIdentifier} already registered!`);
		}
		await this.serviceManager.register(service);
	}

	public registerController(controller: any) {
		throw new Error('Method not implemented.');
	}

	public async initializeAntiCheat(): Promise<boolean> {
		try {
			// Add Services
			await this.registerService(new DatabaseService());
			await this.registerService(new MonitoringService());

			// Init Services
			await this.serviceManager.start();

			// Wait for Services to be ready
			await sleep(1000);
			this.initialized = true;

			return true;
		} catch (error) {
			console.error(error);
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
