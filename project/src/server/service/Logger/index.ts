import { AbstractService, ServiceConfig, ServiceEvent, ServiceManagerEvents } from '..';
import { bootstrap } from '../..';

// Erweiterte Log-Level mit numerischen Werten für Filterung
export enum LogLevel {
	DEBUG = 0,
	INFO = 1,
	WARNING = 2,
	ERROR = 3,
	CRITICAL = 4,
	SECURITY = 5, // Speziell für AntiCheat-Events
}

// Log-Ausgabeziele
export enum LogOutput {
	CONSOLE = 'console',
	FILE = 'file',
	DATABASE = 'database',
	REMOTE = 'remote',
}

// Log-Entry Interface
export interface LogEntry {
	timestamp: number;
	level: LogLevel;
	instance: string;
	message: string;
	metadata?: Record<string, any>;
	playerId?: string; // Für AntiCheat-spezifische Logs
	detectionType?: string; // Art der Erkennung
	severity?: number; // 1-10 Schweregrad
	stackTrace?: string;
}

// Logger-Konfiguration
export interface LoggerConfig {
	minLevel: LogLevel;
	outputs: LogOutput[];
	maxFileSize: number; // MB
	maxFiles: number;
	includeStackTrace: boolean;
	timestampFormat: string;
	bufferSize: number; // Anzahl Logs im Buffer
	flushInterval: number; // ms
	enableColors: boolean;
}

// Verbesserter Logger
export class Logger {
	public readonly serviceIdentifier = 'logger';
	public readonly config: ServiceConfig = {
		priority: 1000, // Höchste Priorität - Logger sollte zuerst starten
		dependencies: [],
		timeout: 100,
		restartOnError: true,
	};

	private readonly instance: string;
	private loggerConfig: LoggerConfig;
	private logBuffer: LogEntry[] = [];
	private flushTimer: NodeJS.Timeout | null = null;
	private fileHandle: any = null; // FiveM file handle
	private logCounter = 0;

	// ANSI Color Codes für Console
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
			outputs: [LogOutput.CONSOLE, LogOutput.FILE],
			maxFileSize: 50, // 50MB
			maxFiles: 10,
			includeStackTrace: false,
			timestampFormat: 'YYYY-MM-DD HH:mm:ss',
			bufferSize: 100,
			flushInterval: 5000, // 5 Sekunden
			enableColors: true,
			...config,
		};
	}

	protected async onServiceEnable(): Promise<void> {
		if (!this.instance) {
			throw new Error('Logger instance name cannot be empty');
		}

		// File logging initialisieren
		// if (this.loggerConfig.outputs.includes(LogOutput.FILE)) {
		// 	await this.initializeFileLogging();
		// }

		// Flush Timer starten
		this.flushTimer = setInterval(() => {
			this.flushBuffer();
		}, this.loggerConfig.flushInterval);

		this.info('Logger service started', {
			instance: this.instance,
			config: this.loggerConfig,
		});

		bootstrap.getServiceManager().onEvent((data: ServiceEvent) => {
			if (data.event === 'health_check_failed') {
				this.healthCheckFailed();
			}
		});
	}

	private healthCheckFailed() {
		this.error('Health check failed', {
			instance: this.instance,
			config: this.loggerConfig,
		});
	}

	protected async onServiceDisable(): Promise<void> {
		// Flush alle verbleibenden Logs
		await this.flushBuffer();

		// Timer stoppen
		if (this.flushTimer) {
			clearInterval(this.flushTimer);
			this.flushTimer = null;
		}

		// File handle schließen
		if (this.fileHandle) {
			// FiveM file closing logic here
			this.fileHandle = null;
		}

		this.info('Logger service stopped');
	}

	protected async onHealthCheck(): Promise<boolean> {
		// Prüfen ob alle konfigurierten Outputs funktionieren
		try {
			// Test log entry
			// const testEntry: LogEntry = {
			// 	timestamp: Date.now(),
			// 	level: LogLevel.DEBUG,
			// 	instance: this.instance,
			// 	message: 'Health check',
			// 	metadata: { healthCheck: true },
			// };

			// // Teste Console Output
			// if (this.loggerConfig.outputs.includes(LogOutput.CONSOLE)) {
			// 	// Console sollte immer funktionieren
			// }

			// // Teste File Output
			// if (this.loggerConfig.outputs.includes(LogOutput.FILE)) {
			// 	if (!this.fileHandle) {
			// 		return false;
			// 	}
			// }

			return true;
		} catch (error) {
			return false;
		}
	}

	// Hauptlog-Methoden
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

	// AntiCheat-spezifische Log-Methoden
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

	// Hauptlog-Methode
	private log(level: LogLevel, message: string, metadata?: Record<string, any>): void {
		// Level-Filter
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

		// Stack trace hinzufügen wenn konfiguriert
		if (this.loggerConfig.includeStackTrace && level >= LogLevel.ERROR) {
			entry.stackTrace = new Error().stack;
		}

		// Zu Buffer hinzufügen
		this.logBuffer.push(entry);
		this.logCounter++;

		// Sofortiger Flush bei kritischen Logs
		if (level >= LogLevel.CRITICAL) {
			this.flushBuffer();
		} else if (this.logBuffer.length >= this.loggerConfig.bufferSize) {
			this.flushBuffer();
		}
	}

	// Buffer leeren und Logs ausgeben
	private async flushBuffer(): Promise<void> {
		if (this.logBuffer.length === 0) return;

		const entries = [...this.logBuffer];
		this.logBuffer = [];

		for (const entry of entries) {
			await this.outputLog(entry);
			console.log('Output');
		}
	}

	// Log-Entry ausgeben
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

	// Log-Entry formatieren
	private formatLogEntry(entry: LogEntry): { console: string; file: string } {
		const timestamp = new Date(entry.timestamp).toISOString();
		const levelName = LogLevel[entry.level];
		const metaString = entry.metadata ? JSON.stringify(entry.metadata) : '';

		// Console Format (mit Farben)
		let consoleFormat = `[${timestamp}][${this.instance}][${levelName}] ${entry.message}`;
		if (metaString) {
			consoleFormat += ` | ${metaString}`;
		}

		if (this.loggerConfig.enableColors) {
			const color = this.colors[entry.level] || '';
			const reset = this.colors.reset;
			consoleFormat = `${color}${consoleFormat}${reset}`;
		}

		// File Format (ohne Farben, strukturiert)
		let fileFormat = `${timestamp} [${this.instance}] ${levelName.padEnd(8)} ${entry.message}`;
		if (metaString) {
			fileFormat += `\n  Metadata: ${metaString}`;
		}
		if (entry.stackTrace) {
			fileFormat += `\n  Stack: ${entry.stackTrace}`;
		}

		return { console: consoleFormat, file: fileFormat };
	}

	// File Logging initialisieren
	private async initializeFileLogging(): Promise<void> {
		// FiveM-spezifische File-Initialisierung
		// const logDir = GetResourcePath(GetCurrentResourceName()) + '/logs/';
		// Hier würdest du FiveM file operations verwenden
	}

	// In Datei schreiben
	private async writeToFile(content: string): Promise<void> {
		// FiveM file writing logic
		// Beispiel: appendToFile(this.fileHandle, content + '\n');
	}

	// In Datenbank schreiben (für wichtige AntiCheat-Events)
	private async writeToDatabase(entry: LogEntry): Promise<void> {
		// Database logging für wichtige Events
		// MySQL.execute('INSERT INTO anticheat_logs ...', [entry]);
	}

	// An Remote-Server senden
	private async sendToRemote(entry: LogEntry): Promise<void> {
		// HTTP request an zentralen Logging-Server
		// für übergreifende AntiCheat-Analyse
	}

	// Log-Statistiken
	public getStats(): {
		totalLogs: number;
		bufferSize: number;
		uptime: number;
		instance: string;
	} {
		return {
			totalLogs: this.logCounter,
			bufferSize: this.logBuffer.length,
			uptime: new Date().getTime() - 9, //TODO!: Change this
			instance: this.instance,
		};
	}

	// Konfiguration zur Laufzeit ändern
	public updateConfig(config: Partial<LoggerConfig>): void {
		this.loggerConfig = { ...this.loggerConfig, ...config };
		this.info('Logger configuration updated', { newConfig: config });
	}

	// Log-Level zur Laufzeit ändern
	public setLogLevel(level: LogLevel): void {
		this.loggerConfig.minLevel = level;
		this.info(`Log level changed to ${LogLevel[level]}`);
	}
}

// Factory für verschiedene Logger-Instanzen
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

// Globaler Logger für einfache Nutzung
export const GlobalLogger = LoggerFactory.create('global', {
	minLevel: LogLevel.INFO,
	outputs: [LogOutput.CONSOLE, LogOutput.FILE],
	enableColors: true,
});
