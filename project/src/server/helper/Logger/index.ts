import { LogEntry, LoggerConfig, LogLevel, LogOutput } from './data';
import { LoggerFactory } from './factory';
import { GlobalLogManager } from './manager';

// Angepasste Logger-Klasse
export class Logger {
	private readonly instance: string;
	private loggerConfig: LoggerConfig;
	private globalManager: GlobalLogManager;

	constructor(instance: string, config?: Partial<LoggerConfig>) {
		this.instance = instance;
		this.globalManager = GlobalLogManager.getInstance();
		this.loggerConfig = {
			minLevel: LogLevel.INFO,
			outputs: [LogOutput.CONSOLE],
			maxFileSize: 50,
			maxFiles: 10,
			includeStackTrace: false,
			timestampFormat: 'YYYY-MM-DD HH:mm:ss',
			bufferSize: 100,
			flushInterval: 1000, // Kürzeres Intervall
			enableColors: true,
			...config,
		};
	}

	public destroyLogger(): void {
		this.info('Logger service stopped');
		// GlobalManager wird nur einmal destroyed
	}

	// Log-Methoden bleiben gleich
	public debug(message: string, metadata?: Record<string, any>): void {
		this.log(LogLevel.DEBUG, message, metadata);
	}

	public info(message: string, metadata?: Record<string, any>): void {
		this.log(LogLevel.INFO, message, metadata);
	}

	public warning(message: string, metadata?: Record<string, any>): void {
		this.log(LogLevel.WARNING, message, metadata);
	}

	public error(message: string, metadata?: Record<string, any>, error?: Error): void {
		const meta = { ...metadata };
		if (error) {
			meta.error = error.message;
			meta.stack = error.stack;
		}
		this.log(LogLevel.ERROR, message, meta);
	}

	public critical(message: string, metadata?: Record<string, any>, error?: Error): void {
		const meta = { ...metadata };
		if (error) {
			meta.error = error.message;
			meta.stack = error.stack;
		}
		this.log(LogLevel.CRITICAL, message, meta);
	}

	public security(message: string, playerId: string, detectionType: string, severity: number = 5, metadata?: Record<string, any>): void {
		this.log(LogLevel.SECURITY, message, {
			...metadata,
			playerId,
			detectionType,
			severity,
			antiCheatEvent: true,
		});
	}

	// Hauptänderung: Logs gehen an GlobalManager
	private log(level: LogLevel, message: string, metadata?: Record<string, any>): void {
		if (level < this.loggerConfig.minLevel) {
			return;
		}

		const entry: LogEntry = {
			timestamp: Date.now(),
			level,
			instance: this.instance,
			message,
			metadata,
		};

		if (this.loggerConfig.includeStackTrace && level >= LogLevel.ERROR) {
			entry.stackTrace = new Error().stack;
		}

		// Sende an globalen Manager statt lokalen Buffer
		this.globalManager.addLogEntry(entry);
	}

	// Entferne alle Buffer-bezogenen Methoden (flushBuffer, sortLogEntries, outputLog)
	// da diese jetzt im GlobalLogManager sind

	public getStats(): {
		totalLogs: number;
		bufferSize: number;
		uptime: number;
		instance: string;
	} {
		return {
			totalLogs: 0, // Könnte vom GlobalManager geholt werden
			bufferSize: 0,
			uptime: 0,
			instance: this.instance,
		};
	}

	public updateConfig(config: Partial<LoggerConfig>): void {
		this.loggerConfig = { ...this.loggerConfig, ...config };
		this.info('Logger configuration updated', { newConfig: config });
	}

	public setLogLevel(level: LogLevel): void {
		this.loggerConfig.minLevel = level;
		this.info(`Log level changed to ${LogLevel[level]}`);
	}
}
