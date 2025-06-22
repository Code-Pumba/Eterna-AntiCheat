import { BaseService } from '..';
import { ServiceConfig } from '../data';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { Logger } from '../../helper/Logger';
import { LoggerFactory } from '../../helper/Logger/factory';

export class Resources extends BaseService {
	public override readonly serviceIdentifier = 'resources';
	public override readonly config: ServiceConfig = {
		priority: 800,
		dependencies: [],
		timeout: 12000,
		restartOnError: true,
	};
	private logger: Logger;

	private resourceFolder: string | undefined;

	public override async onServiceEnable(): Promise<void> {
		this.logger = LoggerFactory.create('resources');
		if (this.resourceFolder) return;

		let currentPath = GetResourcePath(GetCurrentResourceName());

		for (let i = 0; i < 10; i++) {
			if (path.basename(currentPath) === 'resources') {
				this.resourceFolder = currentPath;
				break;
			}

			const parent = path.resolve(currentPath, '..');

			if (parent === currentPath || !fs.existsSync(parent)) {
				this.resourceFolder = undefined;
				break;
			}

			currentPath = parent;
		}

		if (!this.resourceFolder) {
			throw new Error("'resources' Ordner konnte nicht gefunden werden.");
		}

		this.logger.info(`Resource Folder found: ${this.resourceFolder}`);
	}

	public override async onServiceDisable(): Promise<void> {}

	public override async onHealthCheck(): Promise<boolean> {
		return true;
	}
}
