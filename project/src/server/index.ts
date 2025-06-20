import { Bootstrap } from './bootstrap';
import { GlobalLogger, Logger } from './helper/Logger';

export const bootstrap = new Bootstrap();
const logger: Logger = GlobalLogger;

async function main() {
	const isInitialized = await bootstrap.initializeAntiCheat();

	if (!isInitialized) {
		logger.error('AntiCheat could not be initialized!');
		return;
	}

	logger.info(`\n
╔════════════════════════════════════════════╗
║          🐗 AntiCheat Loaded🐗      	     ║
║        Secure. Lightweight. Effective.     ║
╚════════════════════════════════════════════╝
`);
}

void main();
