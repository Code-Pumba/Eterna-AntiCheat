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
	initializeAntiCheat(): Promise<void>;
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
	getControllerManager(): any;
}

export class Bootstrap implements IBoot {
	private serviceManager: ServiceManager;
	// private controllerManager: any; // TODO: Implement

	constructor() {
		this.serviceManager = new ServiceManager();
	}

	public registerService(service: BaseService) {
		if (this.serviceManager.getService(service.serviceIdentifier)) {
			throw new Error(`Service ${service.serviceIdentifier} already registered!`);
		}
		this.serviceManager.register(service);
	}

	public registerController(controller: any) {
		throw new Error('Method not implemented.');
	}

	public async initializeAntiCheat(): Promise<void> {
		// Add Services
		this.registerService(new DatabaseService());
		this.registerService(new MonitoringService());
		// Init Services
		await this.serviceManager.start();
	}

	public destroyAntiCheat(): Promise<void> {
		throw new Error('Method not implemented.');
	}

	public getServiceManager(): ServiceManager {
		return this.serviceManager;
	}

	public getControllerManager(): any {
		throw new Error('Method not implemented.');
	}
}
