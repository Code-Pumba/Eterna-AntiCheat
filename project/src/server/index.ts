import { AntiCheatBootstrap } from './bootstrap';
import { MonitoringService } from './service/Monitoring';

// Globale Bootstrap-Instanz
export const bootstrap = new AntiCheatBootstrap();

// Services registrieren (wird vor dem Start aufgerufen)
export function registerServices(): void {
	// Monitoring Service
	bootstrap.registerService(new MonitoringService());
}

export function registerController(): void {
	// Hier weitere Controller registrieren
}

// Hauptstart-Funktion
export async function startAntiCheat(): Promise<void> {
	try {
		// 1. Services registrieren
		registerServices();

		// 2. System starten
		await bootstrap.start();
	} catch (error) {
		console.error('Failed to start AntiCheat system:', error);
		throw error;
	}
}

// Shutdown-Handler für FiveM
export function setupShutdownHandler(): void {
	on('onResourceStop', async (resourceName: string) => {
		if (resourceName === GetCurrentResourceName()) {
			try {
				await bootstrap.stop();
			} catch (error) {
				console.error('Shutdown error:', error);
			}
		}
	});
}

// Shutdown-Handler einrichten
setupShutdownHandler();

// AntiCheat System starten
void startAntiCheat();
