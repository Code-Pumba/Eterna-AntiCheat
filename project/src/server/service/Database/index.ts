import { createPool, Pool, PoolConnection, PoolOptions } from 'mysql2/promise';
import { BaseService } from '..';
import { ServiceConfig } from '../data';
import { Logger } from '../../helper/Logger';
import { formatConvar } from './helper';
import { LoggerFactory } from '../../helper/Logger/factory';

export interface DatabaseConfig {
	host: string;
	port: number;
	user: string;
	password: string;
	database: string;
	connectionLimit?: number;
	acquireTimeout?: number;
	timeout?: number;
	reconnect?: boolean;
	charset?: string;
}

export class DatabaseService extends BaseService {
	public readonly serviceIdentifier: string = 'database';
	public readonly config: ServiceConfig = {
		priority: 1000,
		dependencies: [],
		timeout: 1000,
		restartOnError: true,
	};

	private pool: Pool | null = null;
	private dbConfig: DatabaseConfig;
	private logger: Logger;

	constructor() {
		super();
		const dbData = formatConvar();

		this.dbConfig = {
			host: dbData.host,
			port: dbData.port,
			user: dbData.user,
			password: dbData.password,
			database: dbData.database,
		};

		this.logger = LoggerFactory.create('database');
	}

	/**
	 * Starts the Database Service
	 * @returns {Promise<void>}
	 */
	public async onServiceEnable(): Promise<void> {
		try {
			const poolConfig: PoolOptions = {
				host: this.dbConfig.host,
				port: this.dbConfig.port,
				user: this.dbConfig.user,
				password: this.dbConfig.password,
				database: this.dbConfig.database,
				connectionLimit: this.dbConfig.connectionLimit || 10,
				charset: this.dbConfig.charset || 'utf8mb4',
				idleTimeout: 300000, // 5m
				connectTimeout: 60000,
				namedPlaceholders: true,
				queueLimit: 0,
				enableKeepAlive: true,
				keepAliveInitialDelay: 0,
			};

			this.pool = createPool(poolConfig);

			// Test connection
			const connection = await this.pool.getConnection();
			await connection.ping();
			connection.release();
		} catch (error) {
			this.logger.error('Failed to start Database Service:', error);
			throw error;
		}
	}

	/**
	 * Stops the Database Service
	 * @returns {Promise<void>}
	 */
	public async onServiceDisable(): Promise<void> {
		try {
			if (this.pool) {
				await this.pool.end();
				this.pool = null;
				this.logger?.info('Database Service stopped');
			}
		} catch (error) {
			this.logger?.error('Error stopping Database Service:', error);
			throw error;
		}
	}

	/**
	 * Checks if the Database Service is healthy
	 * @returns {Promise<boolean>}
	 */
	public async onHealthCheck(): Promise<boolean> {
		try {
			if (!this.pool) {
				return false;
			}

			const connection = await this.pool.getConnection();
			await connection.ping();
			connection.release();
			return true;
		} catch (error) {
			this.logger.error('Database health check failed:', error);
			return false;
		}
	}

	/**
	 * Gets a connection from the pool
	 * @returns {Promise<PoolConnection>}
	 */
	public async getConnection(): Promise<PoolConnection> {
		if (!this.pool) {
			throw new Error('Database Service is not initialized');
		}
		return await this.pool.getConnection();
	}

	/**
	 * Executes a query with parameters
	 * @param query SQL query string
	 * @param params Query parameters
	 * @returns {Promise<any>}
	 */
	public async query(query: string, params?: any[]): Promise<any> {
		if (!this.pool) {
			throw new Error('Database Service is not initialized');
		}

		const connection = await this.pool.getConnection();
		try {
			const [results] = await connection.execute(query, params);
			return results;
		} finally {
			connection.release();
		}
	}

	/**
	 * Executes multiple queries in a transaction
	 * @param queries Array of queries with their parameters
	 * @returns {Promise<any[]>}
	 */
	public async transaction(queries: Array<{ query: string; params?: any[] }>): Promise<any[]> {
		if (!this.pool) {
			throw new Error('Database Service is not initialized');
		}

		const connection = await this.pool.getConnection();
		try {
			await connection.beginTransaction();

			const results: any[] = [];
			for (const { query, params } of queries) {
				const [result] = await connection.execute(query, params);
				results.push(result);
			}

			await connection.commit();
			return results;
		} catch (error) {
			await connection.rollback();
			throw error;
		} finally {
			connection.release();
		}
	}

	/**
	 * Executes a query and returns the first result
	 * @param query SQL query string
	 * @param params Query parameters
	 * @returns {Promise<any>}
	 */
	public async queryFirst(query: string, params?: any[]): Promise<any> {
		const results = await this.query(query, params);
		return Array.isArray(results) && results.length > 0 ? results[0] : null;
	}

	/**
	 * Executes a prepared statement
	 * @param query SQL query string
	 * @param params Query parameters
	 * @returns {Promise<any>}
	 */
	public async prepare(query: string, params?: any[]): Promise<any> {
		if (!this.pool) {
			throw new Error('Database Service is not initialized');
		}

		const connection = await this.pool.getConnection();
		try {
			const statement = await connection.prepare(query);
			const [results] = await statement.execute(params);
			await statement.close();
			return results;
		} finally {
			connection.release();
		}
	}

	/**
	 * Gets current pool statistics
	 * @returns {object} Pool statistics
	 */
	public getPoolStats(): object {
		if (!this.pool) {
			return { error: 'Pool not initialized' };
		}

		return {
			totalConnections: (this.pool as any)._allConnections?.length || 0,
			freeConnections: (this.pool as any)._freeConnections?.length || 0,
			acquiringConnections: (this.pool as any)._acquiringConnections?.length || 0,
		};
	}

	/**
	 * Escapes a string for safe SQL usage
	 * @param value The string to escape
	 * @returns {string} Escaped string
	 */
	public escape(value: string): string {
		if (!this.pool) {
			throw new Error('Database Service is not initialized');
		}
		return this.pool.escape(value);
	}
}
