import { Logger } from '../../helper/Logger';
import { BaseService } from '..';
import { ServiceConfig } from '../data';
import { ResourceState } from './data';
import { sleep } from '../../helper/utils';
import { LoggerFactory } from '../../helper/Logger/factory';

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
	private maxRetries = 10;
	private retryDelay = 1000;

	constructor() {
		super();
		this.logger = LoggerFactory.create('monitoring');
	}

	protected async onServiceEnable(): Promise<void> {
		await this.waitForServerFullyStarted();

		await this.performInitialResourceScan();

		this.detectGamemode();
		this.startContinuousMonitoring();

		this.logger.info(`MonitoringService started. Framework: ${this._gamemode?.toUpperCase() || 'NONE'}`);
		this.logger.info(`There are ${this.allowedResources.size} resources monitored.`);
	}

	private async waitForServerFullyStarted(): Promise<void> {
		let attempts = 0;
		while (!this.checkIfServerIsFullyStarted() && attempts < this.maxRetries) {
			this.logger.debug(`Waiting for server to fully start... ${attempts + 1}/${this.maxRetries}`);
			await sleep(this.retryDelay);
			attempts++;
		}

		if (attempts >= this.maxRetries) {
			this.logger.warning('Server did not fully start within the specified number of retries.');
		}

		this.isFullyStarted = true;
	}

	private async performInitialResourceScan(): Promise<void> {
		for (let scanRound = 0; scanRound < 3; scanRound++) {
			const resourceCount = GetNumResources();
			this.logger.debug(`Resource Scan - ${scanRound + 1}: ${resourceCount} Resources`);

			for (let i = 0; i < resourceCount; i++) {
				try {
					const resourceName = GetResourceByFindIndex(i);
					if (!resourceName || resourceName.trim() === '') {
						continue;
					}

					const resourceState = GetResourceState(resourceName) as ResourceState;

					if (resourceState && resourceState !== 'missing') {
						this.resourceStates.set(resourceName, resourceState);
						this.allowedResources.add(resourceName);
					}
				} catch (error) {
					this.logger.warning(`Error while scanning resource ${i}: ${error}`);
				}
			}

			if (scanRound < 2) {
				await sleep(500);
			}
		}

		this.logger.info(`Initial resource scan completed: ${this.allowedResources.size} Resources`);
	}

	private detectGamemode(): void {
		if (this.allowedResources.has('es_extended')) {
			this._gamemode = 'esx';
		} else if (this.allowedResources.has('qbx_core')) {
			this._gamemode = 'qbx';
		} else {
			this._gamemode = 'NONE';
		}

		this.logger.info(`Framework detected: ${this._gamemode.toUpperCase()}`);
	}

	private startContinuousMonitoring(): void {
		this.checkInterval = setInterval(() => {
			this.performResourceCheck();
		}, this.checkupInterval);
	}

	private performResourceCheck(): void {
		try {
			const currentResourceCount = GetNumResources();
			const previousCount = this.allowedResources.size;

			for (let i = 0; i < currentResourceCount; i++) {
				const resourceName = GetResourceByFindIndex(i);
				if (!resourceName || resourceName.trim() === '') {
					continue;
				}

				const currentState = GetResourceState(resourceName) as ResourceState;
				const previousState = this.resourceStates.get(resourceName);

				if (!this.allowedResources.has(resourceName)) {
					this.allowedResources.add(resourceName);
					this.resourceStates.set(resourceName, currentState);
					this.logger.info(`New resource found: ${resourceName} (State: ${currentState})`);
				} else if (previousState !== currentState) {
					this.resourceStates.set(resourceName, currentState);
					this.logger.debug(`Resource state changed: ${resourceName} (${previousState} → ${currentState})`);
				}
			}

			this.checkForRemovedResources();

			if (this.allowedResources.size !== previousCount) {
				this.logger.info(`Resource count changed: ${previousCount} → ${this.allowedResources.size}`);
			}
		} catch (error) {
			this.logger.error(`Error while performing resource check: ${error}`);
		}
	}

	private checkForRemovedResources(): void {
		const currentResources = new Set<string>();

		for (let i = 0; i < GetNumResources(); i++) {
			const resourceName = GetResourceByFindIndex(i);
			if (resourceName && resourceName.trim() !== '') {
				currentResources.add(resourceName);
			}
		}

		for (const resourceName of this.allowedResources) {
			if (!currentResources.has(resourceName)) {
				this.allowedResources.delete(resourceName);
				this.resourceStates.delete(resourceName);
				this.logger.info(`Resource removed: ${resourceName}`);
			}
		}
	}

	private checkIfServerIsFullyStarted(): boolean {
		const totalResources = GetNumResources();
		let startingResources = 0;

		for (let i = 0; i < totalResources; i++) {
			const name = GetResourceByFindIndex(i);
			if (!name) continue;

			const state = GetResourceState(name);
			if (state === 'starting') {
				startingResources++;
			}
		}

		const threshold = Math.max(1, Math.floor(totalResources * 0.05));
		const isFullyStarted = startingResources < threshold;

		if (!isFullyStarted) {
			this.logger.debug(`${startingResources}/${totalResources} Resources starting...`);
		}

		return isFullyStarted;
	}

	public getUserFramework(): string {
		return this._gamemode;
	}

	public getResourceCount(): number {
		return this.allowedResources.size;
	}

	public getResourceStates(): Map<string, ResourceState> {
		return new Map(this.resourceStates);
	}

	public getAllowedResources(): Set<string> {
		return new Set(this.allowedResources);
	}

	protected async onServiceDisable(): Promise<void> {
		this.logger.info('MonitoringService stopped...');

		if (this.checkInterval) {
			clearInterval(this.checkInterval);
			this.checkInterval = null;
		}

		// Cleanup
		this.resourceStates.clear();
		this.allowedResources.clear();
		this.isFullyStarted = false;
	}

	protected async onHealthCheck(): Promise<boolean> {
		try {
			const resourceCount = GetNumResources();
			const monitoredCount = this.allowedResources.size;

			const discrepancy = Math.abs(resourceCount - monitoredCount);
			const maxDiscrepancy = Math.max(5, resourceCount * 0.1); // 10% Maybe Lower? Or maybe we dont even need this.

			if (discrepancy > maxDiscrepancy) {
				this.logger.warning(`Health Check was unsuccessful: Large discrepancy between current (${resourceCount}) and monitored (${monitoredCount}) resources`);
				return false;
			}

			return true;
		} catch (error) {
			this.logger.error(`Health Check Error: ${error}`);
			return false;
		}
	}
}
