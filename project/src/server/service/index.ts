import { GlobalLogger, Logger } from './Logger';

// Service Status Enum für bessere Zustandsverfolgung
export enum ServiceStatus {
	DISABLED = 'disabled',
	ENABLING = 'enabling',
	ENABLED = 'enabled',
	DISABLING = 'disabling',
	ERROR = 'error',
}

// Erweiterte Service-Konfiguration
export interface ServiceConfig {
	readonly priority: number; // Für Startreihenfolge
	readonly dependencies: string[]; // Service-Abhängigkeiten
	readonly timeout: number; // Timeout für Start/Stop
	readonly restartOnError: boolean; // Auto-Restart bei Fehlern
}

// Verbesserte abstrakte Service-Klasse
export abstract class AbstractService {
	public abstract readonly serviceIdentifier: string;
	public abstract readonly config: ServiceConfig;

	private _status: ServiceStatus = ServiceStatus.DISABLED;
	private _lastError: Error | null = null;
	private _startTime: number | null = null;

	public get status(): ServiceStatus {
		return this._status;
	}

	public get lastError(): Error | null {
		return this._lastError;
	}

	public get uptime(): number {
		return this._startTime ? Date.now() - this._startTime : 0;
	}

	public get isHealthy(): boolean {
		return this._status === ServiceStatus.ENABLED && this._lastError === null;
	}

	// Abstrakte Methoden für Implementierung
	protected abstract onServiceEnable(): Promise<void>;
	protected abstract onServiceDisable(): Promise<void>;
	protected abstract onHealthCheck(): Promise<boolean>;

	// Interne Enable-Methode mit Timeout und Fehlerbehandlung
	public async onEnable(): Promise<void> {
		if (this._status !== ServiceStatus.DISABLED) {
			throw new Error(`Service ${this.serviceIdentifier} is not in disabled state`);
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
			throw error;
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

// Service-Events für bessere Überwachung
export type ServiceManagerEvents = 'started' | 'stopped' | 'error' | 'health_check_failed';
export interface ServiceEvent {
	serviceId: string;
	event: ServiceManagerEvents;
	timestamp: number;
	data?: any;
}

// Verbesserter Service Manager
export class ServiceManager {
	private services: Map<string, AbstractService> = new Map();
	private eventHandlers: ((event: ServiceEvent) => void)[] = [];
	private healthCheckInterval: NodeJS.Timeout | null = null;

	// Service registrieren mit Dependency-Check
	public register(service: AbstractService): void {
		if (this.services.has(service.serviceIdentifier)) {
			throw new Error(`Service ${service.serviceIdentifier} already registered!`);
		}

		// Dependency-Validierung
		for (const dep of service.config.dependencies) {
			if (!this.services.has(dep)) {
				throw new Error(`Dependency ${dep} not found for service ${service.serviceIdentifier}`);
			}
		}

		this.services.set(service.serviceIdentifier, service);
	}

	// Services in korrekter Reihenfolge starten
	public async start(): Promise<void> {
		const sortedServices = this.getSortedServices();
		const errors: Error[] = [];

		for (const service of sortedServices) {
			try {
				await new Promise((resolve) => setTimeout(resolve, service.config.timeout));

				while (service.config.dependencies.length > 0) {
					const depService = this.services.get(service.config.dependencies[0]);
					if (!depService) {
						throw new Error(`Dependency ${service.config.dependencies[0]} not found for service ${service.serviceIdentifier}`);
					}
					if (depService.status !== ServiceStatus.ENABLED) {
						throw new Error(`Dependency ${service.config.dependencies[0]} not enabled for service ${service.serviceIdentifier}`);
					}
					service.config.dependencies.shift();
				}

				await service.onEnable();
				this.emitEvent({
					serviceId: service.serviceIdentifier,
					event: 'started',
					timestamp: Date.now(),
				});
				GlobalLogger.info("Service '" + service.serviceIdentifier + "' started");
			} catch (error) {
				const err = error instanceof Error ? error : new Error(String(error));
				errors.push(err);

				this.emitEvent({
					serviceId: service.serviceIdentifier,
					event: 'error',
					timestamp: Date.now(),
					data: { error: err.message },
				});

				// Bei kritischen Services stoppen
				if (!service.config.restartOnError) {
					throw new Error(`Critical service ${service.serviceIdentifier} failed to start: ${err.message}`);
				}
			}
		}

		// Health Check Timer starten
		this.startHealthChecks();

		if (errors.length > 0) {
			GlobalLogger.warning(`${errors.length} services failed to start`);
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

	// Alle Services stoppen
	public async stop(): Promise<void> {
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

	// Service mit Typ-Safety abrufen
	public getService<T extends AbstractService = AbstractService>(identifier: string): T | undefined {
		return this.services.get(identifier) as T | undefined;
	}

	// Service-Status abrufen
	public getServiceStatus(identifier: string): ServiceStatus | undefined {
		return this.services.get(identifier)?.status;
	}

	// Alle Service-Infos abrufen
	public getServicesInfo(): Array<{
		identifier: string;
		status: ServiceStatus;
		uptime: number;
		isHealthy: boolean;
		lastError: string | null;
		dependencies: string[];
		priority: number;
	}> {
		return Array.from(this.services.values()).map((service) => ({
			identifier: service.serviceIdentifier,
			status: service.status,
			uptime: service.uptime,
			isHealthy: service.isHealthy,
			lastError: service.lastError?.message || null,
			dependencies: service.config.dependencies,
			priority: service.config.priority,
		}));
	}

	// Event Handler hinzufügen
	public onEvent(handler: (event: ServiceEvent) => void): void {
		this.eventHandlers.push(handler);
	}

	// Services nach Priorität und Dependencies sortieren
	private getSortedServices(): AbstractService[] {
		const services = Array.from(this.services.values());
		const sorted: AbstractService[] = [];
		const visited = new Set<string>();
		const visiting = new Set<string>();

		const visit = (service: AbstractService) => {
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

	// Health Checks starten
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

// Beispiel-Implementation eines AntiCheat Services
// export class PlayerValidationService extends AbstractService {
// 	public readonly serviceIdentifier = 'player-validation';
// 	public readonly config: ServiceConfig = {
// 		priority: 100,
// 		dependencies: ['database', 'network'],
// 		timeout: 10000,
// 		restartOnError: true,
// 	};

// 	protected async onServiceEnable(): Promise<void> {
// 		// Service-spezifische Initialisierung
// 		console.log('Player validation service starting...');
// 		// Hier würdest du deine AntiCheat-Logik initialisieren
// 	}

// 	protected async onServiceDisable(): Promise<void> {
// 		console.log('Player validation service stopping...');
// 		// Cleanup
// 	}

// 	protected async onHealthCheck(): Promise<boolean> {
// 		// Prüfen ob Service ordnungsgemäß funktioniert
// 		return true;
// 	}
// }
