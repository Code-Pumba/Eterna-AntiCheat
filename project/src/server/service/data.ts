// Service Status Enum für bessere Zustandsverfolgung
export enum ServiceStatus {
	DISABLED = 'disabled',
	ENABLING = 'enabling',
	ENABLED = 'enabled',
	DISABLING = 'disabling',
	ERROR = 'error',
}

// Erweiterte Service-Konfiguration
export interface ServiceConfig {
	readonly priority: number; // Für Startreihenfolge
	readonly dependencies: string[]; // Service-Abhängigkeiten
	readonly timeout: number; // Timeout für Start/Stop
	readonly restartOnError: boolean; // Auto-Restart bei Fehlern
}

// Service-Events für bessere Überwachung
export type ServiceManagerEvents = 'started' | 'stopped' | 'error' | 'health_check_failed';
export interface ServiceEvent {
	serviceId: string;
	event: ServiceManagerEvents;
	timestamp: number;
	data?: any;
}
