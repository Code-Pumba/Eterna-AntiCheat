/**
 * Status of a service
 */
export enum ServiceStatus {
	DISABLED = 'disabled',
	ENABLING = 'enabling',
	ENABLED = 'enabled',
	DISABLING = 'disabling',
	ERROR = 'error',
}

export interface ServiceConfig {
	/**
	 * Priority of the service
	 */
	readonly priority: number;
	/**
	 * Dependencies of the service
	 */
	readonly dependencies: string[];
	/**
	 * Timeout of the service
	 */
	readonly timeout: number;
	/**
	 * Restart the service on error
	 */
	readonly restartOnError: boolean;
}

/**
 * Events that can be emitted by the ServiceManager
 */
export type ServiceManagerEvents = 'started' | 'stopped' | 'error' | 'health_check_failed';

/**
 * Event that is emitted by the ServiceManager
 */
export interface ServiceEvent {
	serviceId: string;
	event: ServiceManagerEvents;
	timestamp: number;
	data?: any;
}
