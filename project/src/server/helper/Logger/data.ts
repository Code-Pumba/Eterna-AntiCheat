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
