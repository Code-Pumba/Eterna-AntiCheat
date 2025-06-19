import { AbstractService, ServiceManager } from '.';
import { Logger, LoggerFactory } from './Logger';

export class ManagedServiceManager extends ServiceManager {
	private registrationOpen = true;
	private logger: Logger;

	constructor() {
		super();
		this.logger = LoggerFactory.create('service-manager');
	}

	// Services registrieren (nur während Registrierungsphase)
	public register(service: AbstractService): void {
		if (!this.registrationOpen) {
			throw new Error('Service registration is closed. Cannot register new services after startup.');
		}

		console.log(`Registering service: ${service.serviceIdentifier}`);
		super.register(service);
	}

	// Registrierung abschließen und Services starten
	public async initialize(): Promise<void> {
		// Registrierung schließen
		this.registrationOpen = false;
		console.log('Service registration closed, starting services...');

		// Services starten
		await super.start();
		console.log('All services started successfully');
	}

	// Prüfen ob Registrierung noch offen ist
	public isRegistrationOpen(): boolean {
		return this.registrationOpen;
	}
}
