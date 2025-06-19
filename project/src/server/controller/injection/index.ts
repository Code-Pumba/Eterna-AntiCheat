import { BaseController } from '..';

export class InjectionController extends BaseController {
	public readonly controllerName = 'anti-cheat-injection';

	public constructor() {
		super();
	}

	public initialize(): void {
		// Hier kannst du deine Injection-Logik implementieren
	}

	public cleanup(): void {
		// Hier kannst du deine Cleanup-Logik implementieren
	}
}
