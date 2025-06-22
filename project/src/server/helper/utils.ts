import { createHash, randomBytes } from 'crypto';
import PCancelable from 'p-cancelable';

// ===============================
// STRING UTILITIES
// ===============================

export interface RandomStringOptions {
	includeNumbers?: boolean;
	includeUppercase?: boolean;
	includeLowercase?: boolean;
	includeSymbols?: boolean;
	customCharacters?: string;
	excludeSimilar?: boolean; // Excludes 0, O, I, l, 1
}

/**
 * Generates a random string with customizable character sets
 * @param length Length of the string to generate
 * @param options Options for character inclusion
 * @returns Random string
 */
export const generateRandomString = (length: number, options: RandomStringOptions = {}): string => {
	const { includeNumbers = true, includeUppercase = true, includeLowercase = true, includeSymbols = false, customCharacters, excludeSimilar = false } = options;

	let characters = '';

	if (customCharacters) {
		characters = customCharacters;
	} else {
		if (includeLowercase) characters += 'abcdefghijklmnopqrstuvwxyz';
		if (includeUppercase) characters += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
		if (includeNumbers) characters += '0123456789';
		if (includeSymbols) characters += '!@#$%^&*()_+-=[]{}|;:,.<>?';
	}

	if (excludeSimilar) {
		characters = characters.replace(/[0OIl1]/g, '');
	}

	if (characters.length === 0) {
		throw new Error('No characters available for string generation');
	}

	let result = '';
	for (let i = 0; i < length; i++) {
		result += characters.charAt(Math.floor(Math.random() * characters.length));
	}
	return result;
};

/**
 * Generates a cryptographically secure random string
 * @param length Length of the string
 * @param encoding Encoding format ('hex', 'base64', 'base64url')
 * @returns Secure random string
 */
export const generateSecureRandomString = (length: number, encoding: 'hex' | 'base64' | 'base64url' = 'hex'): string => {
	const bytes = randomBytes(Math.ceil(length / 2));

	switch (encoding) {
		case 'base64':
			return bytes.toString('base64').substring(0, length);
		case 'base64url':
			return bytes.toString('base64url').substring(0, length);
		case 'hex':
		default:
			return bytes.toString('hex').substring(0, length);
	}
};

/**
 * Generates various types of UIDs
 */
export class UIDGenerator {
	/**
	 * Generates a simple alphanumeric UID
	 * @param length Length of the UID (default: 8)
	 * @returns Simple UID
	 */
	static simple(length: number = 8): string {
		return generateRandomString(length, { excludeSimilar: true });
	}

	/**
	 * Generates a UUID v4
	 * @returns UUID v4 string
	 */
	static uuid(): string {
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
			const r = (Math.random() * 16) | 0;
			const v = c === 'x' ? r : (r & 0x3) | 0x8;
			return v.toString(16);
		});
	}

	/**
	 * Generates a short UUID (base64 encoded)
	 * @returns Short UUID
	 */
	static shortUuid(): string {
		const bytes = randomBytes(16);
		return bytes.toString('base64url').substring(0, 22);
	}

	/**
	 * Generates a prefixed UID (e.g., "user_ABC123DEF")
	 * @param prefix Prefix for the UID
	 * @param length Length of the random part (default: 8)
	 * @returns Prefixed UID
	 */
	static prefixed(prefix: string, length: number = 8): string {
		return `${prefix}_${this.simple(length)}`;
	}

	/**
	 * Generates a timestamped UID
	 * @param includeRandom Whether to include random part (default: true)
	 * @returns Timestamped UID
	 */
	static timestamped(includeRandom: boolean = true): string {
		const timestamp = Date.now().toString(36);
		return includeRandom ? `${timestamp}_${this.simple(6)}` : timestamp;
	}

	/**
	 * Generates a custom formatted UID based on your comment
	 * @returns Custom formatted UID (e.g., "ea-FHN87123")
	 */
	static custom(): string {
		const prefix = generateRandomString(2, { includeLowercase: true, includeNumbers: false, includeUppercase: false });
		const suffix = generateRandomString(8, { includeNumbers: true, includeUppercase: true, includeLowercase: false });
		return `${prefix}-${suffix}`;
	}
}

/**
 * Legacy function - use UIDGenerator.simple() instead
 * @deprecated Use UIDGenerator.simple() for better functionality
 */
export const generateRandomUID = (): string => UIDGenerator.simple(6);

/**
 * Converts string to various cases
 */
export const StringUtils = {
	toCamelCase: (str: string): string => {
		return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
	},

	toKebabCase: (str: string): string => {
		return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
	},

	toSnakeCase: (str: string): string => {
		return str.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
	},

	toPascalCase: (str: string): string => {
		return str.charAt(0).toUpperCase() + StringUtils.toCamelCase(str.slice(1));
	},

	capitalize: (str: string): string => {
		return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
	},

	truncate: (str: string, length: number, suffix: string = '...'): string => {
		return str.length <= length ? str : str.substring(0, length) + suffix;
	},
};

// ===============================
// ASYNC UTILITIES
// ===============================

/**
 * Enhanced sleep function with optional callback
 * @param ms Milliseconds to sleep
 * @param callback Optional callback to execute after sleep
 * @returns Promise that resolves after specified time
 */
export const sleep = (ms: number, callback?: () => void): Promise<void> => {
	return new Promise((resolve) => {
		setTimeout(() => {
			callback?.();
			resolve();
		}, ms);
	});
};

/**
 * Waits for specified amount of milliseconds before resolving the promise.
 * If the promise is cancelled, it will resolve with false.
 * @param ms Milliseconds to wait
 * @returns Promise that resolves after specified time
 */
export const wait = (ms: number): PCancelable<boolean> => {
	return new PCancelable((resolve, r, onCancel) => {
		onCancel.shouldReject = false;
		const timeout = setTimeout(() => resolve(true), ms);

		onCancel(() => {
			clearTimeout(timeout);
			resolve(false);
		});
	});
};

/**
 * Waits until the specified promise resolves with true.
 * The promise is re-invoked every tick until it resolves with true.
 * If the promise is cancelled, it will resolve with false.
 * @param until Promise that resolves with true when condition is met
 * @param timeout Optional timeout in milliseconds after which the promise is cancelled
 * @returns Promise that resolves after specified time
 */
export const waitUntil = (until: () => Promise<boolean>, timeout?: number): PCancelable<boolean> => {
	const cancelable = new PCancelable<boolean>((resolve, reject, onCancel) => {
		const tick = setTick(async () => {
			const result = await until();

			if (result) {
				clearTick(tick);
				resolve(true);
			}
		});

		onCancel.shouldReject = false;
		onCancel(() => {
			clearTick(tick);
			resolve(false);
		});
	});

	if (timeout) {
		setTimeout(() => {
			try {
				cancelable.cancel();
			} catch {
				// do nothing
			}
		}, timeout);
	}

	return cancelable;
};

/**
 * Delays execution with exponential backoff
 * @param attempt Current attempt number (starts at 0)
 * @param baseDelay Base delay in milliseconds
 * @param maxDelay Maximum delay in milliseconds
 * @returns Promise that resolves after calculated delay
 */
export const exponentialBackoff = (attempt: number, baseDelay: number = 1000, maxDelay: number = 30000): Promise<void> => {
	const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
	return sleep(delay);
};

/**
 * Retry function with exponential backoff
 * @param fn Function to retry
 * @param maxAttempts Maximum number of attempts
 * @param baseDelay Base delay between attempts
 * @returns Promise that resolves with function result or rejects after max attempts
 */
export const retry = async <T>(fn: () => Promise<T>, maxAttempts: number = 3, baseDelay: number = 1000): Promise<T> => {
	let lastError: Error;

	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error as Error;
			if (attempt < maxAttempts - 1) {
				await exponentialBackoff(attempt, baseDelay);
			}
		}
	}

	throw lastError!;
};

/**
 * Debounce function execution
 * @param func Function to debounce
 * @param wait Wait time in milliseconds
 * @returns Debounced function
 */
export const debounce = <T extends (...args: any[]) => any>(func: T, wait: number): ((...args: Parameters<T>) => void) => {
	let timeout: NodeJS.Timeout;

	return (...args: Parameters<T>) => {
		clearTimeout(timeout);
		timeout = setTimeout(() => func(...args), wait);
	};
};

/**
 * Throttle function execution
 * @param func Function to throttle
 * @param limit Time limit in milliseconds
 * @returns Throttled function
 */
export const throttle = <T extends (...args: any[]) => any>(func: T, limit: number): ((...args: Parameters<T>) => void) => {
	let inThrottle: boolean;

	return (...args: Parameters<T>) => {
		if (!inThrottle) {
			func(...args);
			inThrottle = true;
			setTimeout(() => (inThrottle = false), limit);
		}
	};
};

// ===============================
// RANDOM UTILITIES
// ===============================

/**
 * Generates a random integer between min and max (inclusive)
 * @param min Minimum value
 * @param max Maximum value
 * @returns Random integer
 */
export const randomInt = (min: number, max: number): number => {
	if (min > max) throw new Error('Min cannot be greater than max');
	return Math.floor(Math.random() * (max - min + 1)) + min;
};

/**
 * Generates a random float between min and max
 * @param min Minimum value
 * @param max Maximum value
 * @param decimals Number of decimal places (default: 2)
 * @returns Random float
 */
export const randomFloat = (min: number, max: number, decimals: number = 2): number => {
	if (min > max) throw new Error('Min cannot be greater than max');
	const random = Math.random() * (max - min) + min;
	return Number(random.toFixed(decimals));
};

/**
 * Generates a random boolean with optional bias
 * @param trueProbability Probability of returning true (0-1, default: 0.5)
 * @returns Random boolean
 */
export const randomBool = (trueProbability: number = 0.5): boolean => {
	if (trueProbability < 0 || trueProbability > 1) {
		throw new Error('Probability must be between 0 and 1');
	}
	return Math.random() < trueProbability;
};

/**
 * Selects a random element from an array
 * @param array Array to select from
 * @returns Random element or undefined if array is empty
 */
export const randomElement = <T>(array: T[]): T | undefined => {
	if (array.length === 0) return undefined;
	return array[Math.floor(Math.random() * array.length)];
};

/**
 * Selects multiple random elements from an array (with replacement)
 * @param array Array to select from
 * @param count Number of elements to select
 * @returns Array of random elements
 */
export const randomElements = <T>(array: T[], count: number): T[] => {
	if (array.length === 0) return [];
	return Array.from({ length: count }, () => randomElement(array)!);
};

/**
 * Selects multiple unique random elements from an array (without replacement)
 * @param array Array to select from
 * @param count Number of elements to select
 * @returns Array of unique random elements
 */
export const randomUniqueElements = <T>(array: T[], count: number): T[] => {
	if (count > array.length) {
		throw new Error('Count cannot be greater than array length');
	}

	const shuffled = [...array].sort(() => 0.5 - Math.random());
	return shuffled.slice(0, count);
};

/**
 * Generates a random date between start and end dates
 * @param start Start date
 * @param end End date
 * @returns Random date
 */
export const randomDate = (start: Date, end: Date): Date => {
	if (start > end) throw new Error('Start date cannot be after end date');
	return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

/**
 * Shuffles an array using Fisher-Yates algorithm
 * @param array Array to shuffle
 * @returns New shuffled array
 */
export const shuffle = <T>(array: T[]): T[] => {
	const shuffled = [...array];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled;
};

// ===============================
// DATA UTILITIES
// ===============================

/**
 * Deep clones an object
 * @param obj Object to clone
 * @returns Deep cloned object
 */
export const deepClone = <T>(obj: T): T => {
	if (obj === null || typeof obj !== 'object') return obj;
	if (obj instanceof Date) return new Date(obj.getTime()) as T;
	if (obj instanceof Array) return obj.map((item) => deepClone(item)) as T;
	if (obj instanceof Object) {
		const clonedObj = {} as T;
		for (const key in obj) {
			if (obj.hasOwnProperty(key)) {
				clonedObj[key] = deepClone(obj[key]);
			}
		}
		return clonedObj;
	}
	return obj;
};

/**
 * Checks if two objects are deeply equal
 * @param obj1 First object
 * @param obj2 Second object
 * @returns True if objects are deeply equal
 */
export const deepEqual = (obj1: any, obj2: any): boolean => {
	if (obj1 === obj2) return true;
	if (obj1 == null || obj2 == null) return obj1 === obj2;
	if (typeof obj1 !== typeof obj2) return false;

	if (obj1 instanceof Date && obj2 instanceof Date) {
		return obj1.getTime() === obj2.getTime();
	}

	if (Array.isArray(obj1) && Array.isArray(obj2)) {
		if (obj1.length !== obj2.length) return false;
		return obj1.every((val, index) => deepEqual(val, obj2[index]));
	}

	if (typeof obj1 === 'object') {
		const keys1 = Object.keys(obj1);
		const keys2 = Object.keys(obj2);
		if (keys1.length !== keys2.length) return false;
		return keys1.every((key) => deepEqual(obj1[key], obj2[key]));
	}

	return false;
};

/**
 * Omits specified keys from an object
 * @param obj Source object
 * @param keys Keys to omit
 * @returns New object without specified keys
 */
export const omit = <T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> => {
	const result = { ...obj };
	keys.forEach((key) => delete result[key]);
	return result;
};

/**
 * Picks specified keys from an object
 * @param obj Source object
 * @param keys Keys to pick
 * @returns New object with only specified keys
 */
export const pick = <T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> => {
	const result = {} as Pick<T, K>;
	keys.forEach((key) => {
		if (key in obj) {
			result[key] = obj[key];
		}
	});
	return result;
};

// ===============================
// VALIDATION UTILITIES
// ===============================

export const ValidationUtils = {
	isUrl: (url: string): boolean => {
		try {
			new URL(url);
			return true;
		} catch {
			return false;
		}
	},

	isUuid: (uuid: string): boolean => {
		const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
		return uuidRegex.test(uuid);
	},

	isNumeric: (value: string): boolean => {
		return !isNaN(Number(value)) && !isNaN(parseFloat(value));
	},
};

// ===============================
// HASH UTILITIES
// ===============================

export const HashUtils = {
	md5: (data: string): string => {
		return createHash('md5').update(data).digest('hex');
	},

	sha256: (data: string): string => {
		return createHash('sha256').update(data).digest('hex');
	},

	sha512: (data: string): string => {
		return createHash('sha512').update(data).digest('hex');
	},
};

// ===============================
// PERFORMANCE UTILITIES
// ===============================

/**
 * Measures execution time of a function
 * @param fn Function to measure
 * @param label Optional label for logging
 * @returns Object with result and execution time
 */
export const measureTime = async <T>(fn: () => Promise<T>, label?: string): Promise<{ result: T; time: number }> => {
	const start = performance.now();
	const result = await fn();
	const time = performance.now() - start;

	if (label) {
		console.log(`${label} took ${time.toFixed(2)}ms`);
	}

	return { result, time };
};

/**
 * Simple cache implementation
 */
export class SimpleCache<T> {
	private cache = new Map<string, { value: T; expiry: number }>();

	set(key: string, value: T, ttlMs: number = 60000): void {
		this.cache.set(key, {
			value,
			expiry: Date.now() + ttlMs,
		});
	}

	get(key: string): T | undefined {
		const item = this.cache.get(key);
		if (!item) return undefined;

		if (Date.now() > item.expiry) {
			this.cache.delete(key);
			return undefined;
		}

		return item.value;
	}

	has(key: string): boolean {
		return this.get(key) !== undefined;
	}

	delete(key: string): boolean {
		return this.cache.delete(key);
	}

	clear(): void {
		this.cache.clear();
	}

	size(): number {
		return this.cache.size;
	}
}
