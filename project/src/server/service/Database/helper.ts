/**
 * @File Helper functions out of my Roleplay Framework, what no longer gets maintained
 * @Author Code-Pumba | Eterna
 * @URL https://github.com/Code-Pumba
 */

export interface WhereCondition {
	column: string;
	operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IN' | 'NOT IN' | 'IS NULL' | 'IS NOT NULL' | 'BETWEEN';
	value?: any;
	values?: any[]; // For IN, NOT IN, BETWEEN
}

export interface OrderByClause {
	column: string;
	direction: 'ASC' | 'DESC';
}

export interface PaginationOptions {
	limit: number;
	offset: number;
}

export interface SelectOptions {
	columns?: string[];
	joins?: string[];
	where?: WhereCondition[];
	orderBy?: OrderByClause[];
	groupBy?: string[];
	having?: string;
	pagination?: PaginationOptions;
}

export class DatabaseUtils {
	/**
	 * Builds a WHERE clause from an object (simple key-value pairs)
	 * @param conditions Object with column-value pairs
	 * @returns {object} WHERE clause and parameters
	 */
	static buildWhereClause(conditions: Record<string, any>): { where: string; params: any[] } {
		const keys = Object.keys(conditions);
		if (keys.length === 0) {
			return { where: '', params: [] };
		}
		const where = keys.map((key) => `${key} = ?`).join(' AND ');
		const params = keys.map((key) => conditions[key]);
		return { where: `WHERE ${where}`, params };
	}

	/**
	 * Builds a complex WHERE clause with operators
	 * @param conditions Array of WHERE conditions with operators
	 * @returns {object} WHERE clause and parameters
	 */
	static buildComplexWhereClause(conditions: WhereCondition[]): { where: string; params: any[] } {
		if (conditions.length === 0) {
			return { where: '', params: [] };
		}

		const whereParts: string[] = [];
		const params: any[] = [];

		for (const condition of conditions) {
			switch (condition.operator) {
				case 'IS NULL':
				case 'IS NOT NULL':
					whereParts.push(`${condition.column} ${condition.operator}`);
					break;
				case 'IN':
				case 'NOT IN':
					if (!condition.values || condition.values.length === 0) {
						throw new Error(`${condition.operator} requires values array`);
					}
					const placeholders = condition.values.map(() => '?').join(', ');
					whereParts.push(`${condition.column} ${condition.operator} (${placeholders})`);
					params.push(...condition.values);
					break;
				case 'BETWEEN':
					if (!condition.values || condition.values.length !== 2) {
						throw new Error('BETWEEN requires exactly 2 values');
					}
					whereParts.push(`${condition.column} BETWEEN ? AND ?`);
					params.push(condition.values[0], condition.values[1]);
					break;
				default:
					whereParts.push(`${condition.column} ${condition.operator} ?`);
					params.push(condition.value);
			}
		}

		return { where: `WHERE ${whereParts.join(' AND ')}`, params };
	}

	/**
	 * Builds an INSERT statement from an object
	 * @param table Table name
	 * @param data Object with column-value pairs
	 * @returns {object} INSERT statement and parameters
	 */
	static buildInsertStatement(table: string, data: Record<string, any>): { query: string; params: any[] } {
		const keys = Object.keys(data);
		const columns = keys.join(', ');
		const placeholders = keys.map(() => '?').join(', ');
		const params = keys.map((key) => data[key]);
		return {
			query: `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`,
			params,
		};
	}

	/**
	 * Builds a bulk INSERT statement for multiple records
	 * @param table Table name
	 * @param data Array of objects with column-value pairs
	 * @returns {object} INSERT statement and parameters
	 */
	static buildBulkInsertStatement(table: string, data: Record<string, any>[]): { query: string; params: any[] } {
		if (data.length === 0) {
			throw new Error('Data array cannot be empty');
		}

		const keys = Object.keys(data[0]);
		const columns = keys.join(', ');
		const valuePlaceholders = keys.map(() => '?').join(', ');
		const allPlaceholders = data.map(() => `(${valuePlaceholders})`).join(', ');

		const params: any[] = [];
		for (const row of data) {
			for (const key of keys) {
				params.push(row[key]);
			}
		}

		return {
			query: `INSERT INTO ${table} (${columns}) VALUES ${allPlaceholders}`,
			params,
		};
	}

	/**
	 * Builds an INSERT ... ON DUPLICATE KEY UPDATE statement
	 * @param table Table name
	 * @param data Object with column-value pairs
	 * @param updateColumns Columns to update on duplicate key (if empty, updates all except key)
	 * @returns {object} UPSERT statement and parameters
	 */
	static buildUpsertStatement(table: string, data: Record<string, any>, updateColumns?: string[]): { query: string; params: any[] } {
		const insertStatement = this.buildInsertStatement(table, data);

		const columnsToUpdate = updateColumns || Object.keys(data);
		const updateClause = columnsToUpdate.map((col) => `${col} = VALUES(${col})`).join(', ');

		return {
			query: `${insertStatement.query} ON DUPLICATE KEY UPDATE ${updateClause}`,
			params: insertStatement.params,
		};
	}

	/**
	 * Builds an UPDATE statement from an object
	 * @param table Table name
	 * @param data Object with column-value pairs to update
	 * @param conditions Object with WHERE conditions
	 * @returns {object} UPDATE statement and parameters
	 */
	static buildUpdateStatement(table: string, data: Record<string, any>, conditions: Record<string, any>): { query: string; params: any[] } {
		const dataKeys = Object.keys(data);
		const setClause = dataKeys.map((key) => `${key} = ?`).join(', ');
		const dataParams = dataKeys.map((key) => data[key]);
		const { where, params: whereParams } = this.buildWhereClause(conditions);
		return {
			query: `UPDATE ${table} SET ${setClause} ${where}`,
			params: [...dataParams, ...whereParams],
		};
	}

	/**
	 * Builds a DELETE statement
	 * @param table Table name
	 * @param conditions Object with WHERE conditions
	 * @returns {object} DELETE statement and parameters
	 */
	static buildDeleteStatement(table: string, conditions: Record<string, any>): { query: string; params: any[] } {
		const { where, params } = this.buildWhereClause(conditions);
		return {
			query: `DELETE FROM ${table} ${where}`,
			params,
		};
	}

	/**
	 * Builds a SELECT statement with advanced options
	 * @param table Table name
	 * @param options Select options (columns, joins, where, etc.)
	 * @returns {object} SELECT statement and parameters
	 */
	static buildSelectStatement(table: string, options: SelectOptions = {}): { query: string; params: any[] } {
		const { columns = ['*'], joins = [], where = [], orderBy = [], groupBy = [], having, pagination } = options;

		let query = `SELECT ${columns.join(', ')} FROM ${table}`;
		let params: any[] = [];

		// Add JOINs
		if (joins.length > 0) {
			query += ` ${joins.join(' ')}`;
		}

		// Add WHERE clause
		if (where.length > 0) {
			const { where: whereClause, params: whereParams } = this.buildComplexWhereClause(where);
			query += ` ${whereClause}`;
			params.push(...whereParams);
		}

		// Add GROUP BY
		if (groupBy.length > 0) {
			query += ` GROUP BY ${groupBy.join(', ')}`;
		}

		// Add HAVING
		if (having) {
			query += ` HAVING ${having}`;
		}

		// Add ORDER BY
		if (orderBy.length > 0) {
			const orderClauses = orderBy.map((order) => `${order.column} ${order.direction}`);
			query += ` ORDER BY ${orderClauses.join(', ')}`;
		}

		// Add LIMIT and OFFSET
		if (pagination) {
			query += ` LIMIT ${pagination.limit} OFFSET ${pagination.offset}`;
		}

		return { query, params };
	}

	/**
	 * Builds a COUNT query for pagination
	 * @param table Table name
	 * @param where WHERE conditions
	 * @returns {object} COUNT query and parameters
	 */
	static buildCountStatement(table: string, where: WhereCondition[] = []): { query: string; params: any[] } {
		let query = `SELECT COUNT(*) as total FROM ${table}`;
		let params: any[] = [];

		if (where.length > 0) {
			const { where: whereClause, params: whereParams } = this.buildComplexWhereClause(where);
			query += ` ${whereClause}`;
			params.push(...whereParams);
		}

		return { query, params };
	}

	/**
	 * Sanitizes table/column names (prevents SQL injection in identifiers)
	 * @param identifier Table or column name
	 * @returns {string} Sanitized identifier
	 */
	static sanitizeIdentifier(identifier: string): string {
		return identifier.replace(/[^a-zA-Z0-9_]/g, '');
	}

	/**
	 * Builds a search query with LIKE operator
	 * @param table Table name
	 * @param searchColumns Columns to search in
	 * @param searchTerm Search term
	 * @param additionalWhere Additional WHERE conditions
	 * @returns {object} Search query and parameters
	 */
	static buildSearchStatement(table: string, searchColumns: string[], searchTerm: string, additionalWhere: WhereCondition[] = []): { query: string; params: any[] } {
		const searchConditions: WhereCondition[] = searchColumns.map((col) => ({
			column: col,
			operator: 'LIKE',
			value: `%${searchTerm}%`,
		}));

		const allConditions = [...additionalWhere];
		if (searchConditions.length > 0) {
			// Create OR condition for search columns
			const searchWhereParts = searchConditions.map((cond) => `${cond.column} LIKE ?`);
			const searchParams = searchConditions.map((cond) => cond.value);

			let query = `SELECT * FROM ${table}`;
			let params: any[] = [];

			if (additionalWhere.length > 0) {
				const { where: additionalWhereClause, params: additionalParams } = this.buildComplexWhereClause(additionalWhere);
				query += ` ${additionalWhereClause} AND (${searchWhereParts.join(' OR ')})`;
				params.push(...additionalParams, ...searchParams);
			} else {
				query += ` WHERE (${searchWhereParts.join(' OR ')})`;
				params.push(...searchParams);
			}

			return { query, params };
		}

		return this.buildSelectStatement(table, { where: additionalWhere });
	}

	/**
	 * Creates a CASE statement builder
	 * @param column Column to evaluate
	 * @returns {object} CASE statement builder
	 */
	static createCaseStatement(column: string) {
		return {
			cases: [] as Array<{ when: string; then: any }>,
			elseValue: null as any,

			when(condition: string, value: any) {
				this.cases.push({ when: condition, then: value });
				return this;
			},

			else(value: any) {
				this.elseValue = value;
				return this;
			},

			build(): string {
				let caseStatement = `CASE ${column}`;
				for (const caseItem of this.cases) {
					caseStatement += ` WHEN ${caseItem.when} THEN ${caseItem.then}`;
				}
				if (this.elseValue !== null) {
					caseStatement += ` ELSE ${this.elseValue}`;
				}
				caseStatement += ' END';
				return caseStatement;
			},
		};
	}

	/**
	 * Validates and formats date for database
	 * @param date Date to format
	 * @returns {string} Formatted date string
	 */
	static formatDate(date: Date): string {
		return date.toISOString().slice(0, 19).replace('T', ' ');
	}

	/**
	 * Builds a query with dynamic sorting and filtering
	 * @param table Table name
	 * @param filters Key-value pairs for filtering
	 * @param sortBy Column to sort by
	 * @param sortOrder Sort order (ASC/DESC)
	 * @param limit Number of records to limit
	 * @param offset Number of records to skip
	 * @returns {object} Dynamic query and parameters
	 */
	static buildDynamicQuery(table: string, filters: Record<string, any> = {}, sortBy?: string, sortOrder: 'ASC' | 'DESC' = 'ASC', limit?: number, offset?: number): { query: string; params: any[] } {
		const whereConditions: WhereCondition[] = Object.entries(filters).map(([key, value]) => ({
			column: key,
			operator: '=',
			value,
		}));

		const orderBy: OrderByClause[] = sortBy ? [{ column: sortBy, direction: sortOrder }] : [];
		const pagination = limit ? { limit, offset: offset || 0 } : undefined;

		return this.buildSelectStatement(table, {
			where: whereConditions,
			orderBy,
			pagination,
		});
	}
}

/**
 * Query Builder for easier database queries
 * since we cannot use Prisma
 */
export class DatabaseQueryBuilder {
	private tableName: string;
	private selectColumns: string[] = ['*'];
	private joinClauses: string[] = [];
	private whereConditions: WhereCondition[] = [];
	private orderByClauses: OrderByClause[] = [];
	private groupByColumns: string[] = [];
	private havingClause?: string;
	private limitCount?: number;
	private offsetCount?: number;

	constructor(table: string) {
		this.tableName = table;
	}

	select(columns: string[]): this {
		this.selectColumns = columns;
		return this;
	}

	join(joinClause: string): this {
		this.joinClauses.push(joinClause);
		return this;
	}

	where(column: string, operator: WhereCondition['operator'], value?: any, values?: any[]): this {
		this.whereConditions.push({ column, operator, value, values });
		return this;
	}

	orderBy(column: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
		this.orderByClauses.push({ column, direction });
		return this;
	}

	groupBy(columns: string[]): this {
		this.groupByColumns = columns;
		return this;
	}

	having(clause: string): this {
		this.havingClause = clause;
		return this;
	}

	limit(count: number): this {
		this.limitCount = count;
		return this;
	}

	offset(count: number): this {
		this.offsetCount = count;
		return this;
	}

	build(): { query: string; params: any[] } {
		return DatabaseUtils.buildSelectStatement(this.tableName, {
			columns: this.selectColumns,
			joins: this.joinClauses,
			where: this.whereConditions,
			orderBy: this.orderByClauses,
			groupBy: this.groupByColumns,
			having: this.havingClause,
			pagination: this.limitCount ? { limit: this.limitCount, offset: this.offsetCount || 0 } : undefined,
		});
	}
}

/**
 * Thanks to https://github.com/overextended/oxmysql/blob/main/src/config.ts for the Part of Parsing the Convar
 * @returns {ConnectionOptions}
 */
export function formatConvar(): Record<string, any> {
	const convarString = GetConvar('mysql_connection_string', '');

	if (!convarString || convarString.length < 1) throw new Error('Missing mysql_connection_string convar.');

	const splitMatchGroups = convarString.match(new RegExp('^(?:([^:/?#.]+):)?(?://(?:([^/?#]*)@)?([\\w\\d\\-\\u0100-\\uffff.%]*)(?::([0-9]+))?)?([^?#]+)?(?:\\?([^#]*))?$')) as RegExpMatchArray;

	if (!splitMatchGroups) throw new Error(`mysql_connection_string structure was invalid (${convarString})`);

	const authTarget = splitMatchGroups[2] ? splitMatchGroups[2].split(':') : [];

	const options = {
		user: authTarget[0] || undefined,
		password: authTarget[1] || undefined,
		host: splitMatchGroups[3],
		port: parseInt(splitMatchGroups[4]),
		database: splitMatchGroups[5]?.replace(/^\/+/, ''),
		...(splitMatchGroups[6] &&
			splitMatchGroups[6].split('&').reduce<Record<string, string>>((connectionInfo, parameter) => {
				const [key, value] = parameter.split('=');
				connectionInfo[key] = value;
				return connectionInfo;
			}, {})),
	};

	return options;
}
