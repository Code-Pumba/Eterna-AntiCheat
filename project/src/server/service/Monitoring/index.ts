import { LoggerFactory, Logger } from '../../helper/Logger';
import { BaseService } from '..';
import { ServiceConfig } from '../data';
import { ResourceState } from './data';

/**
 * Testing if this could working, for anti injection.
 * We are getting, the full resource list at the Start.
 */
export class MonitoringService extends BaseService {
	public readonly serviceIdentifier: string = 'monitoring';

	private _gamemode: string = null;

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
		let resourcesList = GetNumResources();

		// Get Resources Initial
		for (let i = 0; i < resourcesList; i++) {
			const resourceName = GetResourceByFindIndex(i);
			const resourceState = GetResourceState(resourceName) as ResourceState;
			this.resourceStates.set(resourceName, resourceState);
		}

		// Checkup Interval
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

		// Get _Gamemode
		this._gamemode =
			['qbx_core', 'es_extended']
				.find((framework) => this.allowedResources.has(framework))
				?.replace('qbx_core', 'qbx')
				?.replace('es_extended', 'esx') || 'unknown';

		this.logger.info(`We Found ${this._gamemode === 'esx' ? 'ESX' : 'QBX'} Framework`);
	}

	public getUserFramework(): string {
		return this._gamemode;
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
		//TODO! MISSING HEALTH CHECK
		return true;
	}
}
