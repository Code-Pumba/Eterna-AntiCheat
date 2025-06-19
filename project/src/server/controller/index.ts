import { bootstrap } from '..';
import { AbstractService } from '../service';

// Base Controller Klasse
export abstract class BaseController {
	abstract readonly controllerName: string;

	// Service Manager Zugriff
	protected getService<T extends AbstractService>(serviceId: string): T {
		const service = bootstrap.getServiceManager().getService<T>(serviceId);
		if (!service) {
			throw new Error(`Service ${serviceId} not found`);
		}
		return service;
	}

	// Abstrakte Methoden
	public abstract initialize(): void;
	public abstract cleanup(): void;
}

export class ControllerManager {
	private controllers: Map<string, BaseController> = new Map();

	public register(controller: BaseController): void {
		if (this.controllers.has(controller.controllerName)) {
			throw new Error(`Controller ${controller.controllerName} already registered`);
		}

		this.controllers.set(controller.controllerName, controller);
	}
}
