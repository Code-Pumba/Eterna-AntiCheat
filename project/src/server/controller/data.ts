export enum ControllerStatus {
	DISABLED = 'DISABLED',
	ENABLING = 'ENABLING',
	ENABLED = 'ENABLED',
	DISABLING = 'DISABLING',
	ERROR = 'ERROR',
}

export enum ControllerType {
	EVENT = 'EVENT',
	LOOP = 'LOOP',
	HYBRID = 'HYBRID',
}

// Config for Controller
export interface ControllerConfig {
	timeout: number;
	autoStart?: boolean;
	loopInterval?: number;
}

// Manager Options
export interface ControllerManagerOptions {
	autoStart?: boolean;
	startTimeout?: number;
	healthCheckInterval?: number;
	maxRetries?: number;
}
