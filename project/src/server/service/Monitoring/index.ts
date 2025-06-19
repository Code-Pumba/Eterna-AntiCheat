import { LoggerFactory, Logger } from '../../helper/Logger';
import { BaseService } from '..';
import { ServiceConfig } from '../data';
import { ResourceState } from './data';

export class MonitoringService extends BaseService {
	public readonly serviceIdentifier: string = 'monitoring';

	public readonly config: ServiceConfig = {
		priority: 500,
		dependencies: [],
		timeout: 12000,
		restartOnError: true,
	};

	private checkInterval: NodeJS.Timeout | null = null;

	private resourceStates: Map<string, ResourceState> = new Map();
	private allowedResources: Set<string> = new Set();
	private checkupInterval = 5000;

	private isFullyStarted: boolean = false;

	private logger: Logger;

	constructor() {
		super();
		this.logger = LoggerFactory.create('monitoring');
	}

	protected async onServiceEnable(): Promise<void> {
		// Service-spezifische Initialisierung
		this.logger.info('=== AntiCheat Monitoring Service ===');

		while (!this.logger) {
			await new Promise((resolve) => setTimeout(resolve, 100));
		}

		// Hier würdest du deine AntiCheat-Logik initialisieren

		let resourcesList = GetNumResources();

		// Get Resources Initial
		for (let i = 0; i < resourcesList; i++) {
			const resourceName = GetResourceByFindIndex(i);
			const resourceState = GetResourceState(resourceName) as ResourceState;
			this.resourceStates.set(resourceName, resourceState);
		}

		// Checkup Intervall starten
		this.checkInterval = setInterval(() => {
			if (!this.isFullyStarted && !this.checkIfServerIsFullyStarted()) {
				this.isFullyStarted = false;
				return;
			}

			if (!this.isFullyStarted) {
				this.isFullyStarted = true;
			}

			this.checkupResources();
		}, this.checkupInterval);

		this.logger.info(' === AntiCheat Monitoring Service started  ===');
	}

	private checkIfServerIsFullyStarted(): boolean {
		for (let i = 0; i < GetNumResources(); i++) {
			const name = GetResourceByFindIndex(i);
			if (GetResourceState(name) !== 'started') {
				return false;
			}
		}
		return true;
	}

	private checkupResources(): void {
		for (let i = 0; i < GetNumResources(); i++) {
			const resourceName = GetResourceByFindIndex(i);
			const resourceState = GetResourceState(resourceName) as ResourceState;

			if (this.allowedResources.has(resourceName)) {
				continue;
			}

			if (this.resourceStates.get(resourceName) !== resourceState) {
				this.resourceStates.set(resourceName, resourceState);
			}

			this.allowedResources.add(resourceName);
		}

		clearInterval(this.checkInterval);
		this.checkInterval = null;
	}

	protected async onServiceDisable(): Promise<void> {
		console.log('Monitoring service stopping...');
		// Cleanup
	}

	protected async onHealthCheck(): Promise<boolean> {
		// Prüfen ob Service ordnungsgemassen funktioniert
		return true;
	}
}
