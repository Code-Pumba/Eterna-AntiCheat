import { BaseService } from '..';
import { bootstrap } from '../..';
import { Bootstrap } from '../../bootstrap';
import { Logger, LoggerFactory } from '../../helper/Logger';
import { SimpleCache } from '../../helper/utils';
import { ServiceConfig } from '../data';
import { DatabaseService } from '../Database';
import { BanEntity, IBanEntity } from '../Database/entities/BanEntity';
import { DatabaseQueryBuilder, DatabaseUtils } from '../Database/helper';
import { ServiceManager } from '../manager';

export class BanEntityService extends BaseService {
	public readonly serviceIdentifier = 'banEntityService';
	public readonly config: ServiceConfig = {
		priority: 500,
		dependencies: ['database'],
		timeout: 10000,
		restartOnError: true,
	};

	private readonly logger: Logger;
	private readonly database: DatabaseService;

	private cache: SimpleCache<BanEntity> = new SimpleCache<BanEntity>();
	private banStats: number = 0;

	constructor() {
		super();
		this.logger = LoggerFactory.create('banEntityService');
		this.database = this.serviceManager.getService<DatabaseService>('database');
	}

	protected override async onServiceEnable(): Promise<void> {
		try {
			const query = DatabaseUtils.buildCountStatement('player_bans', []);
			const result = await this.database.query(query.query, query.params);
			this.banStats = result[0].total;

			this.logger.info(`We have found over ${this.banStats} banned players.`);
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err));
			this.logger.error(`Error while starting service "${this.serviceIdentifier}": ${error.message}`);
		}
	}

	protected override async onServiceDisable(): Promise<void> {}

	protected override async onHealthCheck(): Promise<boolean> {
		return await this.database.healthCheck();
	}
}
