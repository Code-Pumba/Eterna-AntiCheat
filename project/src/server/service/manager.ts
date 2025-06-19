import { BaseService } from '.';
import { Logger, LoggerFactory } from '../helper/Logger';
import { ServiceEvent, ServiceStatus } from './data';

export class ServiceManager {
	private services: Map<string, BaseService> = new Map();
	private eventHandlers: ((event: ServiceEvent) => void)[] = [];
	private healthCheckInterval: NodeJS.Timeout | null = null;

	private logger: Logger;

	constructor() {
		this.logger = LoggerFactory.create('service-manager');
	}

	public register(service: BaseService) {
		if (this.services.has(service.serviceIdentifier)) {
			this.logger.warning(`We couldn't register service "${service.serviceIdentifier}" because it already exists!`);
			return;
		}

		for (const dep of service.config.dependencies) {
			if (this.services.has(dep)) {
				this.logger.error(`We couldn't register service "${service.serviceIdentifier}" because it depends on "${dep}" which doesn't exist!`);
				return;
			}
		}

		this.services.set(service.serviceIdentifier, service);
		this.logger.info(`Service "${service.serviceIdentifier}" registered successfully!`);
	}

	public async start() {
		const sortedServices = this.getSortedServices();
		const errors: Error[] = [];

		for (const service of sortedServices) {
			try {
				await service.onEnable();
				this.emitEvent({
					serviceId: service.serviceIdentifier,
					event: 'started',
					timestamp: Date.now(),
				});

				this.logger.info(`Service "${service.serviceIdentifier}" started successfully!`);
			} catch (error) {
				const err = error instanceof Error ? error : new Error(String(error));
				errors.push(err);
				this.logger.error(`Error while starting service "${service.serviceIdentifier}": ${err.message}`);
				this.emitEvent({
					serviceId: service.serviceIdentifier,
					event: 'error',
					timestamp: Date.now(),
					data: { error: err.message },
				});
			}
		}

		this.startHealthChecks();

		if (errors.length > 0) {
			this.logger.warning(`${errors.length} services failed to start!`);
		}
	}

	public async stop() {
		if (this.healthCheckInterval) {
			clearInterval(this.healthCheckInterval);
			this.healthCheckInterval = null;
		}

		const sortedServices = this.getSortedServices().reverse();
		const errors: Error[] = [];

		for (const service of sortedServices) {
			try {
				await service.onDisable();
				this.emitEvent({
					serviceId: service.serviceIdentifier,
					event: 'stopped',
					timestamp: Date.now(),
				});
			} catch (error) {
				errors.push(error instanceof Error ? error : new Error(String(error)));
			}
		}

		if (errors.length > 0) {
			throw new Error(`${errors.length} services failed to stop gracefully`);
		}
	}

	// Bestimmten Service starten
	public async startService(identifier: string): Promise<void> {
		const service = this.services.get(identifier);
		if (!service) {
			throw new Error(`Service ${identifier} not found`);
		}

		// Dependencies prüfen
		for (const dep of service.config.dependencies) {
			const depService = this.services.get(dep);
			if (!depService || depService.status !== ServiceStatus.ENABLED) {
				throw new Error(`Dependency ${dep} is not running for service ${identifier}`);
			}
		}

		await service.onEnable();
		console.log("Service '" + identifier + "' started");
		this.emitEvent({
			serviceId: identifier,
			event: 'started',
			timestamp: Date.now(),
		});
	}

	// Service stoppen
	public async stopService(identifier: string): Promise<void> {
		const service = this.services.get(identifier);
		if (!service) {
			throw new Error(`Service ${identifier} not found`);
		}

		// Abhängige Services prüfen
		const dependentServices = Array.from(this.services.values()).filter((s) => s.config.dependencies.includes(identifier) && s.status === ServiceStatus.ENABLED);

		if (dependentServices.length > 0) {
			const dependentNames = dependentServices.map((s) => s.serviceIdentifier).join(', ');
			throw new Error(`Cannot stop ${identifier}: Services ${dependentNames} depend on it`);
		}

		await service.onDisable();
		this.emitEvent({
			serviceId: identifier,
			event: 'stopped',
			timestamp: Date.now(),
		});
	}

	public getService<T extends BaseService = BaseService>(identifier: string): T | undefined {
		return this.services.get(identifier) as T;
	}

	public getServiceStatus(identifier: string): ServiceStatus | undefined {
		return this.getService(identifier)?.status;
	}

	public getServiceInfo(): Array<{ identifier: string; status: ServiceStatus; uptime: number; isHealthy: boolean; lastError: string | null; dependencies: string[]; priority: number }> {
		return Array.from(this.services.values()).map((service) => ({
			identifier: service.serviceIdentifier,
			status: service.status,
			uptime: service.uptime,
			isHealthy: service.isHealthy,
			lastError: service._lastError?.message ?? null,
			dependencies: service.config.dependencies,
			priority: service.config.priority,
		}));
	}

	public onEvent(handler: (event: ServiceEvent) => void): void {
		this.eventHandlers.push(handler);
	}

	// Services nach Priorität und Dependencies sortieren
	private getSortedServices(): BaseService[] {
		const services = Array.from(this.services.values());
		const sorted: BaseService[] = [];
		const visited = new Set<string>();
		const visiting = new Set<string>();

		const visit = (service: BaseService) => {
			if (visiting.has(service.serviceIdentifier)) {
				throw new Error(`Circular dependency detected involving ${service.serviceIdentifier}`);
			}
			if (visited.has(service.serviceIdentifier)) {
				return;
			}

			visiting.add(service.serviceIdentifier);

			// Dependencies zuerst besuchen
			for (const dep of service.config.dependencies) {
				const depService = this.services.get(dep);
				if (depService) {
					visit(depService);
				}
			}

			visiting.delete(service.serviceIdentifier);
			visited.add(service.serviceIdentifier);
			sorted.push(service);
		};

		// Nach Priorität sortieren, dann topologisch sortieren
		services.sort((a, b) => b.config.priority - a.config.priority).forEach(visit);

		return sorted;
	}

	private startHealthChecks(): void {
		this.healthCheckInterval = setInterval(async () => {
			for (const service of this.services.values()) {
				if (service.status === ServiceStatus.ENABLED) {
					const healthy = await service.healthCheck();
					if (!healthy) {
						this.emitEvent({
							serviceId: service.serviceIdentifier,
							event: 'health_check_failed',
							timestamp: Date.now(),
						});

						// Auto-Restart wenn konfiguriert
						if (service.config.restartOnError) {
							try {
								await service.onDisable();
								await service.onEnable();
							} catch (error) {
								this.emitEvent({
									serviceId: service.serviceIdentifier,
									event: 'error',
									timestamp: Date.now(),
									data: { error: 'Auto-restart failed' },
								});
							}
						}
					}
				}
			}
		}, 30000); // Health Check alle 30 Sekunden
	}

	// Event emittieren
	private emitEvent(event: ServiceEvent): void {
		this.eventHandlers.forEach((handler) => {
			try {
				handler(event);
			} catch (error) {
				console.error('Event handler error:', error);
			}
		});
	}

	// Restart mit besserer Fehlerbehandlung
	public async restart(): Promise<void> {
		await this.stop();
		await new Promise((resolve) => setTimeout(resolve, 1000)); // Kurze Pause
		await this.start();
	}
}
