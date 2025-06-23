import { BanEntity } from '../service/Database/entities/BanEntity';
import { DatabaseUtils, WhereCondition } from '../service/Database/helper';
import { Repository } from './repository';

export class BanRepository extends Repository<BanEntity> {
	constructor() {
		super('player_bans');
	}

	/**
	 * Maps a database row to a BanEntity.
	 *
	 * @param row The row from the database.
	 * @returns A new BanEntity with the properties from the row.
	 */
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

	/**
	 * Maps a BanEntity to a database row.
	 *
	 * @param entity The entity to map.
	 * @returns The row to insert into the database.
	 */
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

	/**
	 * Finds all active bans from the database.
	 *
	 * @returns A promise which resolves to an array of active BanEntity objects.
	 */
	public async findActiveBans(): Promise<BanEntity[]> {
		return this.findBy({ is_active: true });
	}

	/**
	 * Finds a ban by its ban identifier.
	 *
	 * @param banIdentifier The ban identifier to search for.
	 * @returns A promise which resolves to the BanEntity with the given ban identifier, or null if no such ban exists.
	 */
	public async findByBanIdentifier(banIdentifier: string): Promise<BanEntity | null> {
		return this.findOne({ ban_identifier: banIdentifier });
	}

	/**
	 * Finds all bans with the given hwid hash.
	 *
	 * @param hwidHash The hwid hash to search for.
	 * @returns A promise which resolves to an array of BanEntity objects with the given hwid hash.
	 */
	public async findByHwidHash(hwidHash: string): Promise<BanEntity[]> {
		return this.findBy({ hwid_hash: hwidHash });
	}

	/**
	 * Finds all expired bans that are still active.
	 *
	 * The method constructs a complex query with conditions to identify bans where
	 * the expiration date is before the current date and the ban is still marked as active.
	 *
	 * @returns A promise which resolves to an array of BanEntity objects representing expired, yet active bans.
	 */

	public async findExpiredBans(): Promise<BanEntity[]> {
		const conditions: WhereCondition[] = [
			{ column: 'expires_at', operator: '<', value: DatabaseUtils.formatDate(new Date()) },
			{ column: 'is_active', operator: '=', value: true },
		];

		return this.findWithComplexWhere(conditions);
	}

	/**
	 * Finds a ban by searching for a given license in the identifier column.
	 *
	 * The method performs a LIKE query on the identifier column with a wildcard prefix and suffix.
	 *
	 * @param license The license to search for in the identifier column.
	 * @returns A promise which resolves to the BanEntity with the given license identifier, or null if no such ban exists.
	 */
	public async findByIdentifier(license: string): Promise<BanEntity | null> {
		const { query, params } = DatabaseUtils.buildSelectStatement(this.tableName, {
			where: [{ column: 'identifier', operator: 'LIKE', value: `%${license}%` }],
		});

		const result = (await this.database.query(query, params)) as any[];
		return result.length > 0 ? this.mapRowToEntity(result[0]) : null;
	}

	/**
	 * Deactivates all expired bans by setting the "is_active" column to false
	 * and updating the "updated_at" column with the current date.
	 *
	 * The method will return the number of affected rows.
	 *
	 * @returns A promise which resolves to the number of affected rows.
	 */
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

	/**
	 * Finds all active bans that match the given search term in the reason, banned_by, or ban_identifier columns.
	 *
	 * @param searchTerm The search term to search for in the reason, banned_by, and ban_identifier columns.
	 * @returns A promise which resolves to an array of BanEntity objects that match the given search term.
	 */
	public async searchBans(searchTerm: string): Promise<BanEntity[]> {
		return this.search(['reason', 'banned_by', 'ban_identifier'], searchTerm, { is_active: true });
	}

	/**
	 * Finds all active bans that match any of the given identifiers.
	 *
	 * @param identifiers An array of identifiers to search for in the identifier column.
	 * @returns A promise which resolves to an array of BanEntity objects that match any of the given identifiers.
	 */
	public async findByIdentifiers(identifiers: string[]): Promise<BanEntity[]> {
		// TODO: Optimize
		const placeholders = identifiers.map(() => 'JSON_CONTAINS(identifier, ?)').join(' OR ');
		const query = `SELECT * FROM ${this.tableName} WHERE is_active = ? AND (${placeholders})`;
		const params = [true, ...identifiers.map((id) => JSON.stringify(id))];

		const result = await this.executeCustomQuery(query, params);
		return result.map((row) => this.mapRowToEntity(row));
	}
}
