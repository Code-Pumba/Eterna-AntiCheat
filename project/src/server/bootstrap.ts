import { BaseService } from './service';
import { ServiceManager } from './service/manager';
import { MonitoringService } from './service/Monitoring';

export interface IBoot {
	registerService(service: any): void;
	registerController(controller: any): void;
	initializeAntiCheat(): Promise<void>;
	destroyAntiCheat(): Promise<void>;

	// Getter
	getServiceManager(): any;
	getControllerManager(): any;
}

export class Bootstrap implements IBoot {
	private serviceManager: ServiceManager;
	private controllerManager: any;

	private initialized: boolean = false;

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
