import { AbstractService, ServiceManager } from './service';
import { Logger, LoggerFactory } from './service/Logger';
import { ManagedServiceManager } from './service/managedService';

// Bootstrap-Klasse für strukturierten Startup
export class AntiCheatBootstrap {
	private serviceManager: ManagedServiceManager;
	private logger: Logger;
	private isInitialized = false;

	constructor() {
		this.serviceManager = new ManagedServiceManager();
		this.logger = LoggerFactory.create('bootstrap');
	}

	// Service registrieren
	public registerService(service: AbstractService): void {
		if (this.isInitialized) {
			throw new Error('Cannot register services after initialization');
		}
		this.serviceManager.register(service);
	}

	// Alle Services starten
	public async start(): Promise<void> {
		if (this.isInitialized) {
			throw new Error('Bootstrap already initialized');
		}

		try {
			console.log('=== AntiCheat System Starting ===');

			// Services initialisieren (registrierung schließen + starten)
			await this.serviceManager.initialize();

			this.isInitialized = true;
			console.log('=== AntiCheat System Ready ===');
		} catch (error) {
			console.log('Bootstrap failed', { error });
			throw error;
		}
	}

	// System herunterfahren
	public async stop(): Promise<void> {
		if (!this.isInitialized) {
			return;
		}

		try {
			console.log('Shutting down AntiCheat system...');
			await this.serviceManager.stop();
			this.isInitialized = false;
			console.log('AntiCheat system stopped');
		} catch (error) {
			console.log('Shutdown failed', { error });
			throw error;
		}
	}

	// Service Manager zugriff
	public getServiceManager(): ServiceManager {
		return this.serviceManager;
	}

	// Status prüfen
	public isReady(): boolean {
		return this.isInitialized;
	}
}
