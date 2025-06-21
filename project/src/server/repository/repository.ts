import { BaseEntity } from '../service/Database/entities/BaseEntity';
import { DatabaseService } from '../service/Database';
import { bootstrap } from '..';
import { DatabaseUtils, OrderByClause, WhereCondition } from '../service/Database/helper';

// Repository Interface
export interface IRepository<T extends BaseEntity> {
	findById(id: number): Promise<T | null>;
	findAll(options?: QueryOptions): Promise<T[]>;
	findBy(criteria: Record<string, any>): Promise<T[]>;
	findOne(criteria: Record<string, any>): Promise<T | null>;
	create(entity: T): Promise<T>;
	update(entity: T): Promise<T | null>;
	delete(id: number): Promise<boolean>;
	exists(id: number): Promise<boolean>;
	count(criteria?: Record<string, any>): Promise<number>;
}

export interface QueryOptions {
	limit?: number;
	offset?: number;
	orderBy?: string;
	orderDirection?: 'ASC' | 'DESC';
	select?: string[];
}

// Abstrakte Repository-Klasse
export abstract class Repository<T extends BaseEntity> implements IRepository<T> {
	protected tableName: string;
	protected database: DatabaseService;

	constructor(tableName: string) {
		this.tableName = tableName;
		this.database = bootstrap.getServiceManager().getService<DatabaseService>('database');
	}

	// Abstrakte Methoden die implementiert werden müssen
	protected abstract mapRowToEntity(row: any): T;
	protected abstract mapEntityToRow(entity: Partial<T>): Record<string, any>;

	public async findById(id: number): Promise<T | null> {
		const { query, params } = DatabaseUtils.buildSelectStatement(this.tableName, {
			where: [{ column: 'id', operator: '=', value: id }],
		});

		const result = (await this.database.query(query, params)) as any[];
		return result.length > 0 ? this.mapRowToEntity(result[0]) : null;
	}

	public async findAll(options: QueryOptions = {}): Promise<T[]> {
		const orderBy: OrderByClause[] = options.orderBy ? [{ column: options.orderBy, direction: options.orderDirection || 'ASC' }] : [];

		const pagination = options.limit ? { limit: options.limit, offset: options.offset || 0 } : undefined;

		const { query, params } = DatabaseUtils.buildSelectStatement(this.tableName, {
			columns: options.select || ['*'],
			orderBy,
			pagination,
		});

		const result = (await this.database.query(query, params)) as any[];
		return result.map((row) => this.mapRowToEntity(row));
	}

	public async findBy(criteria: Record<string, any>): Promise<T[]> {
		if (Object.keys(criteria).length === 0) {
			return this.findAll();
		}

		const whereConditions: WhereCondition[] = Object.entries(criteria).map(([key, value]) => {
			if (Array.isArray(value)) {
				return { column: key, operator: 'IN', values: value };
			}
			return { column: key, operator: '=', value };
		});

		const { query, params } = DatabaseUtils.buildSelectStatement(this.tableName, {
			where: whereConditions,
		});

		const result = (await this.database.query(query, params)) as any[];
		return result.map((row) => this.mapRowToEntity(row));
	}

	public async findOne(criteria: Record<string, any>): Promise<T | null> {
		const results = await this.findBy(criteria);
		return results.length > 0 ? results[0] : null;
	}

	public async create(entity: T): Promise<T> {
		const data = this.mapEntityToRow(entity);

		// Timestamps automatisch setzen
		data.created_at = DatabaseUtils.formatDate(new Date());
		data.updated_at = DatabaseUtils.formatDate(new Date());

		const { query, params } = DatabaseUtils.buildInsertStatement(this.tableName, data);
		const result = await this.database.query(query, params);

		// Annahme: result enthält die insertId
		const insertId = (result as any).insertId || (result as any)[0]?.insertId;

		if (!insertId) {
			throw new Error('Failed to create entity - no insert ID returned');
		}

		const created = await this.findById(insertId);
		if (!created) {
			throw new Error('Failed to retrieve created entity');
		}

		return created;
	}

	public async update(entity: T): Promise<T | null> {
		// Entity's update() method aufrufen
		entity.update();

		const data = this.mapEntityToRow(entity);
		data.updated_at = DatabaseUtils.formatDate(entity.updatedAt);

		const { query, params } = DatabaseUtils.buildUpdateStatement(this.tableName, data, { id: entity.id });

		await this.database.query(query, params);
		return this.findById(entity.id);
	}

	public async delete(id: number): Promise<boolean> {
		const { query, params } = DatabaseUtils.buildDeleteStatement(this.tableName, { id });
		const result = await this.database.query(query, params);
		return (result as any).affectedRows > 0;
	}

	public async exists(id: number): Promise<boolean> {
		const { query, params } = DatabaseUtils.buildCountStatement(this.tableName, [{ column: 'id', operator: '=', value: id }]);

		const result = (await this.database.query(query, params)) as any[];
		return result[0]?.total > 0;
	}

	public async count(criteria?: Record<string, any>): Promise<number> {
		const whereConditions: WhereCondition[] = criteria
			? Object.entries(criteria).map(([key, value]) => {
					if (Array.isArray(value)) {
						return { column: key, operator: 'IN', values: value };
					}
					return { column: key, operator: '=', value };
			  })
			: [];

		const { query, params } = DatabaseUtils.buildCountStatement(this.tableName, whereConditions);
		const result = (await this.database.query(query, params)) as any[];
		return result[0]?.total || 0;
	}

	protected async executeCustomQuery(query: string, params: any[] = []): Promise<any[]> {
		return (await this.database.query(query, params)) as any[];
	}

	protected async search(searchColumns: string[], searchTerm: string, additionalWhere?: Record<string, any>): Promise<T[]> {
		const additionalConditions: WhereCondition[] = additionalWhere
			? Object.entries(additionalWhere).map(([key, value]) => ({
					column: key,
					operator: '=',
					value,
			  }))
			: [];

		const { query, params } = DatabaseUtils.buildSearchStatement(this.tableName, searchColumns, searchTerm, additionalConditions);

		const result = await this.executeCustomQuery(query, params);
		return result.map((row) => this.mapRowToEntity(row));
	}

	protected async findWithComplexWhere(conditions: WhereCondition[]): Promise<T[]> {
		const { query, params } = DatabaseUtils.buildSelectStatement(this.tableName, {
			where: conditions,
		});

		const result = await this.executeCustomQuery(query, params);
		return result.map((row) => this.mapRowToEntity(row));
	}

	protected serializeArray(arr: any[]): string {
		return JSON.stringify(arr);
	}

	protected deserializeArray(str: string | null): any[] {
		if (!str) return [];
		try {
			return JSON.parse(str);
		} catch {
			return [];
		}
	}

	protected async createMany(entities: T[]): Promise<T[]> {
		if (entities.length === 0) return [];

		const data = entities.map((entity) => {
			const mapped = this.mapEntityToRow(entity);
			mapped.created_at = DatabaseUtils.formatDate(new Date());
			mapped.updated_at = DatabaseUtils.formatDate(new Date());
			return mapped;
		});

		const { query, params } = DatabaseUtils.buildBulkInsertStatement(this.tableName, data);
		await this.database.query(query, params);

		const recentEntities = await this.findWithComplexWhere([{ column: 'created_at', operator: '>=', value: DatabaseUtils.formatDate(new Date(Date.now() - 1000)) }]);

		return recentEntities.slice(-entities.length);
	}
}
