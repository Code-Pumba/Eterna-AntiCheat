import { Bootstrap } from './bootstrap';
import { GlobalLogger, Logger } from './helper/Logger';

export const bootstrap = new Bootstrap();
const logger: Logger = GlobalLogger;

async function main() {
	await bootstrap.initializeAntiCheat();

	logger.info(`
╔════════════════════════════════════════════╗
║          🐗 AntiCheat Loaded🐗      	     ║
║        Secure. Lightweight. Effective.     ║
╚════════════════════════════════════════════╝
`);
}

void main();
