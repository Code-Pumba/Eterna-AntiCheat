import { Logger } from '.';
import { LoggerConfig } from './data';

export class LoggerFactory {
	private static loggers: Map<string, Logger> = new Map();

	public static create(instance: string, config?: Partial<LoggerConfig>): Logger {
		if (this.loggers.has(instance)) {
			return this.loggers.get(instance)!;
		}

		const logger = new Logger(instance, config);
		this.loggers.set(instance, logger);
		return logger;
	}

	public static get(instance: string): Logger | undefined {
		return this.loggers.get(instance);
	}

	public static getAll(): Logger[] {
		return Array.from(this.loggers.values());
	}
}
