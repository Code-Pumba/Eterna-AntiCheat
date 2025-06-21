import { LogEntry, LoggerConfig, LogLevel, LogOutput } from './data';

export class Logger {
	private readonly instance: string;
	private loggerConfig: LoggerConfig;
	private logBuffer: LogEntry[] = [];
	private flushTimer: NodeJS.Timeout | null = null;
	private fileHandle: any = null;
	private logCounter = 0;

	private readonly colors = {
		[LogLevel.DEBUG]: '\x1b[36m', // Cyan
		[LogLevel.INFO]: '\x1b[32m', // Green
		[LogLevel.WARNING]: '\x1b[33m', // Yellow
		[LogLevel.ERROR]: '\x1b[31m', // Red
		[LogLevel.CRITICAL]: '\x1b[35m', // Magenta
		[LogLevel.SECURITY]: '\x1b[41m', // Red background
		reset: '\x1b[0m',
	};

	constructor(instance: string, config?: Partial<LoggerConfig>) {
		this.instance = instance;
		this.loggerConfig = {
			minLevel: LogLevel.INFO,
			outputs: [LogOutput.CONSOLE], // We could add File Logging with LogOutput.FILE
			maxFileSize: 50, // 50MB
			maxFiles: 10,
			includeStackTrace: false,
			timestampFormat: 'YYYY-MM-DD HH:mm:ss',
			bufferSize: 100,
			flushInterval: 5000, // 5s
			enableColors: true,
			...config,
		};

		// Flush Timer
		this.flushTimer = setInterval(() => {
			this.flushBuffer();
		}, this.loggerConfig.flushInterval);

		// this.info('Created a Logger Instance', {
		// 	instance: this.instance,
		// });
	}

	// Stop Method
	public destroyLogger(): void {
		if (this.flushTimer) {
			clearInterval(this.flushTimer);
			this.flushTimer = null;
		}

		if (this.fileHandle) {
			this.fileHandle.close();
			this.fileHandle = null;
		}
		this.info('Logger service stopped');
	}

	// main Log Methoden
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

	public playerAction(playerId: string, action: string, metadata?: Record<string, any>): void {
		this.info(`Player action: ${action}`, {
			...metadata,
			playerId,
			actionType: action,
			category: 'player-action',
		});
	}

	public detection(playerId: string, detectionType: string, severity: number, details: Record<string, any>): void {
		this.security(`AntiCheat detection: ${detectionType}`, playerId, detectionType, severity, {
			...details,
			category: 'detection',
		});
	}

	// Main Log Method
	private log(level: LogLevel, message: string, metadata?: Record<string, any>): void {
		if (level < this.loggerConfig.minLevel) {
			return;
		}

		const entry: LogEntry = {
			timestamp: Date.now(),
			preciseTimestamp: performance.now(),
			level,
			instance: this.instance,
			message,
			metadata,
		};

		// Stack trace
		if (this.loggerConfig.includeStackTrace && level >= LogLevel.ERROR) {
			entry.stackTrace = new Error().stack;
		}

		// add to buffer
		this.logBuffer.push(entry);
		this.logCounter++;

		// Flush Instantly if the level is Critical
		if (level >= LogLevel.CRITICAL) {
			this.flushBuffer();
		} else if (this.logBuffer.length >= this.loggerConfig.bufferSize) {
			this.flushBuffer();
		}
	}

	// Buffer clearing and flushing
	private async flushBuffer(): Promise<void> {
		if (this.logBuffer.length === 0) return;

		const entries = this.sortLogEntries([...this.logBuffer]);
		this.logBuffer = [];

		for (const entry of entries) {
			await this.outputLog(entry);
		}
	}

	private sortLogEntries(entries: LogEntry[]): LogEntry[] {
		return entries.sort((a, b) => {
			if (a.timestamp !== b.timestamp) {
				return a.timestamp - b.timestamp;
			}

			return a.preciseTimestamp - b.preciseTimestamp;
		});
	}

	// Output Log
	private async outputLog(entry: LogEntry): Promise<void> {
		const formatted = this.formatLogEntry(entry);

		// Console Output
		if (this.loggerConfig.outputs.includes(LogOutput.CONSOLE)) {
			console.log(formatted.console);
		}

		// File Output
		// if (this.loggerConfig.outputs.includes(LogOutput.FILE)) {
		// 	await this.writeToFile(formatted.file);
		// }

		// Database Output (für AntiCheat-Events)
		// if (this.loggerConfig.outputs.includes(LogOutput.DATABASE) && entry.level >= LogLevel.SECURITY) {
		// 	await this.writeToDatabase(entry);
		// }

		// Remote Output (für zentrale Überwachung)
		// if (this.loggerConfig.outputs.includes(LogOutput.REMOTE)) {
		// 	await this.sendToRemote(entry);
		// }
	}

	// Log-Entry formatting
	private formatLogEntry(entry: LogEntry): { console: string; file: string } {
		const timestamp = new Date(entry.timestamp).toLocaleTimeString();
		const levelName = LogLevel[entry.level];
		const metaString = entry.metadata ? JSON.stringify(entry.metadata) : '';

		// Console Format (with colors)
		let consoleFormat = `[${timestamp}][${levelName}][${this.instance}] ${entry.message}`;
		if (metaString) {
			consoleFormat += ` | ${metaString}`;
		}

		if (this.loggerConfig.enableColors) {
			const color = this.colors[entry.level] || '';
			const reset = this.colors.reset;
			consoleFormat = `${color}${consoleFormat}${reset}`;
		}

		let fileFormat = `${timestamp} [${this.instance}] ${levelName.padEnd(8)} ${entry.message}`;
		if (metaString) {
			fileFormat += `\n  Metadata: ${metaString}`;
		}
		if (entry.stackTrace) {
			fileFormat += `\n  Stack: ${entry.stackTrace}`;
		}

		return { console: consoleFormat, file: fileFormat };
	}

	private async initializeFileLogging(): Promise<void> {
		// FiveM-spezifische File-Initialisierung
		// const logDir = GetResourcePath(GetCurrentResourceName()) + '/logs/';
		// Hier würdest du FiveM file operations verwenden
	}

	private async writeToFile(content: string): Promise<void> {
		// FiveM file writing logic
		// Beispiel: appendToFile(this.fileHandle, content + '\n');
	}

	private async writeToDatabase(entry: LogEntry): Promise<void> {
		// Database logging für wichtige Events
		// MySQL.execute('INSERT INTO anticheat_logs ...', [entry]);
	}

	private async sendToRemote(entry: LogEntry): Promise<void> {
		// HTTP request an zentralen Logging-Server
		// für übergreifende AntiCheat-Analyse
	}

	// Log-Stats
	public getStats(): {
		totalLogs: number;
		bufferSize: number;
		uptime: number;
		instance: string;
	} {
		return {
			totalLogs: this.logCounter,
			bufferSize: this.logBuffer.length,
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

// Global Logger
export const GlobalLogger = LoggerFactory.create('global', {
	minLevel: LogLevel.INFO,
	outputs: [LogOutput.CONSOLE],
	enableColors: true,
});
