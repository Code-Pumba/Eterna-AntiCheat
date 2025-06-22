import { BaseController } from '..';
import { Logger } from '../../helper/Logger';
import { LoggerFactory } from '../../helper/Logger/factory';
import { sleep, wait } from '../../helper/utils';
import { BanRepository } from '../../repository/PlayerBans';
import { ControllerConfig, ControllerType } from '../data';
import { AdaptiveCard, getAdaptiveCard, replacePlaceholders } from './adaptiveCardHelper';
import { Deferrals } from './types';

export class PlayerConnectController extends BaseController {
	public override readonly controllerIdentifier = 'playerConnect';
	public override readonly eventName = 'playerConnecting';
	public override readonly type = ControllerType.EVENT;

	private _banRepository: BanRepository;
	private logger: Logger;
	private _adaptiveCard: AdaptiveCard;

	public override readonly config: ControllerConfig = {
		timeout: 10000,
		autoStart: false,
	};

	public override async onControllerEnable(): Promise<void> {
		this._banRepository = new BanRepository();
		this._adaptiveCard = getAdaptiveCard();
		this.logger = LoggerFactory.create('playerConnect');

		if (GetResourceState('hardcap') === 'started') {
			this.logger.info('Hardcap is enabled, disabling it now..');
			StopResource('hardcap');
		}
	}

	public override async onControllerDisable(): Promise<void> {
		this._banRepository = null;
	}

	public override async onHealthCheck(): Promise<boolean> {
		return true;
	}

	public override async onEventHandler(name: string, setKickReason: (reason: string) => void, deferrals: Deferrals): Promise<void> {
		deferrals.defer();
		await wait(0);
		deferrals.update('Hello, we are currently setting everything up.. Please be patient');
		let card = replacePlaceholders(this._adaptiveCard, { BANNED_PLAYERS: '12', ACTIVE_PLAYERS: '203', QUEUE_POSITION: '5' });

		deferrals.presentCard(JSON.stringify(card), (data, rawData) => {
			console.log(data, rawData); // Currently useless since we dont have buttons
		});
		await wait(500000);
		deferrals.done('Test');
	}
}
