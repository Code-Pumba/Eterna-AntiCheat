export enum LogLevel {
	DEBUG = 0,
	INFO = 1,
	WARNING = 2,
	ERROR = 3,
	CRITICAL = 4,
	SECURITY = 5, // Security Related
}

// Log output types
export enum LogOutput {
	CONSOLE = 'console',
	FILE = 'file',
	DATABASE = 'database',
	REMOTE = 'remote',
}

// Log-Entry Interface
export interface LogEntry {
	timestamp: number;
	preciseTimestamp: number; // performance.now();
	level: LogLevel;
	instance: string;
	message: string;
	metadata?: Record<string, any>;
	playerId?: string;
	detectionType?: string;
	severity?: number; // 1-10
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
	bufferSize: number; // Logs inside the Buffer
	flushInterval: number; // ms
	enableColors: boolean;
}
