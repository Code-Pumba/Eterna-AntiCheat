import { LogEntry, LogLevel } from './data';

export class GlobalLogManager {
	private static instance: GlobalLogManager;
	private globalBuffer: LogEntry[] = [];
	private flushTimer: NodeJS.Timeout | null = null;
	private readonly config = {
		bufferSize: 100,
		flushInterval: 1000, // Kürzeres Intervall für bessere Chronologie
	};

	private readonly colors = {
		[LogLevel.DEBUG]: '\x1b[36m',
		[LogLevel.INFO]: '\x1b[32m',
		[LogLevel.WARNING]: '\x1b[33m',
		[LogLevel.ERROR]: '\x1b[31m',
		[LogLevel.CRITICAL]: '\x1b[35m',
		[LogLevel.SECURITY]: '\x1b[41m',
		reset: '\x1b[0m',
	};

	private constructor() {
		this.flushTimer = setInterval(() => {
			this.flushGlobalBuffer();
		}, this.config.flushInterval);
	}

	public static getInstance(): GlobalLogManager {
		if (!GlobalLogManager.instance) {
			GlobalLogManager.instance = new GlobalLogManager();
		}
		return GlobalLogManager.instance;
	}

	public addLogEntry(entry: LogEntry): void {
		this.globalBuffer.push(entry);

		// Sofort flushen bei kritischen Logs oder wenn Buffer voll
		if (entry.level >= LogLevel.CRITICAL || this.globalBuffer.length >= this.config.bufferSize) {
			this.flushGlobalBuffer();
		}
	}

	private flushGlobalBuffer(): void {
		if (this.globalBuffer.length === 0) return;

		// Sortiere ALLE Logs chronologisch
		const sortedEntries = this.globalBuffer.sort((a, b) => a.timestamp - b.timestamp);
		this.globalBuffer = [];

		// Gebe alle Logs in chronologischer Reihenfolge aus
		sortedEntries.forEach((entry) => {
			this.outputLog(entry);
		});
	}

	private formatLogEntry(entry: LogEntry): { console: string; file: string } {
		const timestamp = new Date(entry.timestamp).toLocaleTimeString();
		const levelName = LogLevel[entry.level];
		const metaString = entry.metadata ? JSON.stringify(entry.metadata) : '';

		let consoleFormat = [timestamp, levelName, entry.instance, entry.message].join(' ');
		if (metaString) {
			consoleFormat += ` | ${metaString}`;
		}

		const color = this.colors[entry.level] || '';
		const reset = this.colors.reset;
		consoleFormat = `${color}${consoleFormat}${reset}`;

		let fileFormat = [timestamp, entry.instance, levelName.padEnd(8), entry.message].join(' ');
		if (metaString) {
			fileFormat += `\n  Metadata: ${metaString}`;
		}
		if (entry.stackTrace) {
			fileFormat += `\n  Stack Trace: ${entry.stackTrace}`;
		}

		return { console: consoleFormat, file: fileFormat };
	}

	private outputLog(entry: LogEntry): void {
		const logMessage = this.formatLogEntry(entry).console;
		console.log(logMessage);
	}

	public destroy(): void {
		if (this.flushTimer) {
			clearInterval(this.flushTimer);
			this.flushTimer = null;
		}
		this.flushGlobalBuffer(); // Final flush
	}
}
