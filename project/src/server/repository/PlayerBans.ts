import { BanEntity } from '../service/Database/entities/BanEntity';
import { DatabaseUtils, WhereCondition } from '../service/Database/helper';
import { Repository } from './repository';

export class BanRepository extends Repository<BanEntity> {
	constructor() {
		super('bans');
	}

	protected mapRowToEntity(row: any): BanEntity {
		const entity = new BanEntity(row.id);

		entity.reason = row.reason;
		entity.bannedBy = row.banned_by;
		entity.identifier = this.deserializeArray(row.identifier);
		entity.ipAdress = row.ip_address;
		entity.hwidHash = row.hwid_hash;
		entity.expiresAt = new Date(row.expires_at);
		entity.isActive = Boolean(row.is_active);
		entity.note = row.note;
		entity.automatic = Boolean(row.automatic);
		entity.banIdentifier = row.ban_identifier;
		entity.evidenceUrls = this.deserializeArray(row.evidence_urls);

		// BaseEntity
		entity.createdAt = new Date(row.created_at);
		entity.updatedAt = new Date(row.updated_at);

		return entity;
	}

	protected mapEntityToRow(entity: Partial<BanEntity>): Record<string, any> {
		const row: Record<string, any> = {};

		if (entity.reason !== undefined) row.reason = entity.reason;
		if (entity.bannedBy !== undefined) row.banned_by = entity.bannedBy;
		if (entity.identifier !== undefined) row.identifier = this.serializeArray(entity.identifier);
		if (entity.ipAdress !== undefined) row.ip_address = entity.ipAdress;
		if (entity.hwidHash !== undefined) row.hwid_hash = entity.hwidHash;
		if (entity.expiresAt !== undefined) row.expires_at = DatabaseUtils.formatDate(entity.expiresAt);
		if (entity.isActive !== undefined) row.is_active = entity.isActive;
		if (entity.note !== undefined) row.note = entity.note;
		if (entity.automatic !== undefined) row.automatic = entity.automatic;
		if (entity.banIdentifier !== undefined) row.ban_identifier = entity.banIdentifier;
		if (entity.evidenceUrls !== undefined) row.evidence_urls = this.serializeArray(entity.evidenceUrls);

		return row;
	}

	// Custom methods
	public async findActiveBans(): Promise<BanEntity[]> {
		return this.findBy({ is_active: true });
	}

	public async findByBanIdentifier(banIdentifier: string): Promise<BanEntity | null> {
		return this.findOne({ ban_identifier: banIdentifier });
	}

	public async findByHwidHash(hwidHash: string): Promise<BanEntity[]> {
		return this.findBy({ hwid_hash: hwidHash });
	}

	public async findExpiredBans(): Promise<BanEntity[]> {
		const conditions: WhereCondition[] = [
			{ column: 'expires_at', operator: '<', value: DatabaseUtils.formatDate(new Date()) },
			{ column: 'is_active', operator: '=', value: true },
		];

		return this.findWithComplexWhere(conditions);
	}

	public async deactivateExpiredBans(): Promise<number> {
		///@ts-expect-error
		//TODO: Fix this later on
		const { query, params } = DatabaseUtils.buildUpdateStatement(
			this.tableName,
			{
				is_active: false,
				updated_at: DatabaseUtils.formatDate(new Date()),
			},
			{
				expires_at: { operator: '<', value: DatabaseUtils.formatDate(new Date()) },
				is_active: true,
			}
		);

		// extends DatabaseUtils for more complex WHERE in UPDATE
		// Alternative: Custom Query
		const customQuery = `
      		UPDATE ${this.tableName} 
      		SET is_active = ?, updated_at = ? 
      		WHERE expires_at < ? AND is_active = ?
    	`;
		const customParams = [false, DatabaseUtils.formatDate(new Date()), DatabaseUtils.formatDate(new Date()), true];

		const result = await this.executeCustomQuery(customQuery, customParams);
		return (result as any).affectedRows || 0;
	}

	public async searchBans(searchTerm: string): Promise<BanEntity[]> {
		return this.search(['reason', 'banned_by', 'ban_identifier'], searchTerm, { is_active: true });
	}

	public async findByIdentifiers(identifiers: string[]): Promise<BanEntity[]> {
		// TODO: Optimize
		const placeholders = identifiers.map(() => 'JSON_CONTAINS(identifier, ?)').join(' OR ');
		const query = `SELECT * FROM ${this.tableName} WHERE is_active = ? AND (${placeholders})`;
		const params = [true, ...identifiers.map((id) => JSON.stringify(id))];

		const result = await this.executeCustomQuery(query, params);
		return result.map((row) => this.mapRowToEntity(row));
	}
}
