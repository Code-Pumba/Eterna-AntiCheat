import { Bootstrap } from './bootstrap';
import { Logger } from './helper/Logger';
import { LoggerFactory } from './helper/Logger/factory';

export const bootstrap = new Bootstrap();
const logger: Logger = LoggerFactory.create('main');

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
