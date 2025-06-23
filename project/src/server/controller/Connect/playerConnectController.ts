import PCancelable from 'p-cancelable';
import { BaseController } from '..';
import { Logger } from '../../helper/Logger';
import { LoggerFactory } from '../../helper/Logger/factory';
import { sleep, wait } from '../../helper/utils';
import { BanRepository } from '../../repository/PlayerBans';
import { ControllerConfig, ControllerType } from '../data';
import { AdaptiveCard, getAdaptiveCard, replacePlaceholders } from './adaptiveCardHelper';
import { Deferrals } from './types';
import { getLicenseIdentifier, getPlayerHardwareId, getPlayerIp, getSteamHexIdentifier } from '../../helper/Identifier';
import { BanEntity } from '../../service/Database/entities/BanEntity';

interface PlayerIdentifiers {
	license: string | null;
	steam: string;
	hwid: string | null;
	ip: string | null;
}

interface BanCheckResult {
	isBanned: boolean;
	banEntity?: BanEntity;
	showCard: boolean;
}

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

	public override async onEventHandler(source: number, name: string, setKickReason: (reason: string) => void, deferrals: Deferrals): Promise<void> {
		// const src = source; // I really hate fivem for this shit | This was the Fix and the reason why it works now....
		deferrals.defer();
		await wait(1000);
		deferrals.update('Connecting to server... Please be patient');
		this.logger.info('Player connecting: ' + name);
		await wait(2000); // Maybe we need to throttle this?
		try {
			// Spieler-Identifikatoren sammeln
			const playerIdentifiers = this.getPlayerIdentifiers(source);

			this.logger.info("Got player's identifiers: " + JSON.stringify(playerIdentifiers));

			if (!this.validatePlayerIdentifiers(playerIdentifiers)) {
				this.logger.info('Could not retrieve your player data completely. Please restart the game.');
				const errorMessage = 'Could not retrieve your player data completely. Please restart the game.';
				deferrals.done(errorMessage);
				setKickReason(errorMessage);
				return;
			}

			this.logger.info(`Player connecting: License=${playerIdentifiers.license}, Steam=${playerIdentifiers.steam}, HWID=${playerIdentifiers.hwid}`);

			// Ban-Prüfung durchführen
			const banInfo = await this.checkPlayerBan(playerIdentifiers);

			if (banInfo.isBanned) {
				const banMessage = this.formatBanMessage(banInfo);
				deferrals.done(banMessage);
				setKickReason(banMessage);

				// Optional: Adaptive Card für Banned Players anzeigen
				if (banInfo.showCard) {
					await this.presentBanCard(deferrals, banInfo);
				}
				return;
			}

			// Debug Options for showing off the AdaptiveCard
			let debug = true;
			if (debug) {
				await this.presentBanCard(deferrals, {
					isBanned: true,
					showCard: true,
					banEntity: new BanEntity(0, {
						id: 0,
						reason: 'Test if Banned',
						bannedBy: 'System',
						identifier: ['license', 'steam'],
						ipAdress: '127.0.0.1',
						hwidHash: 'testHash',
						expiresAt: new Date(),
						isActive: true,
						note: null,
						automatic: false,
						banIdentifier: 'testBan',
						evidenceUrls: [],
					}),
				});
				return;
			}

			// Erfolgreiche Verbindung
			await this.finalizeConnection(deferrals);
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error));
			this.logger.error('Error during connection setup:', { error: err.message, stack: err.stack }, err);
			const errorMessage = 'An unexpected error occurred. Please try again.';
			deferrals.done(errorMessage);
			setKickReason(errorMessage);
		}
	}

	private getPlayerIdentifiers(source: number): PlayerIdentifiers {
		return {
			license: getLicenseIdentifier(source),
			steam: getSteamHexIdentifier(source) ?? 'N/A',
			hwid: getPlayerHardwareId(source),
			ip: getPlayerIp(source),
		};
	}

	private validatePlayerIdentifiers(identifiers: PlayerIdentifiers): boolean {
		return !!(identifiers.license && identifiers.hwid && identifiers.ip);
	}

	private async checkPlayerBan(identifiers: PlayerIdentifiers): Promise<BanCheckResult> {
		// Firstly we check if there are bans for this HardwareHash (Aka. PlayerToken)
		let banEntities = await this._banRepository.findByHwidHash(identifiers.hwid);

		if (banEntities.length === 0) {
			// If there are no bans for this HardwareHash, we check if there are bans for any of the other identifiers
			const identifierList = [identifiers.license, identifiers.steam].filter((id) => id !== 'N/A');
			banEntities = await this._banRepository.findByIdentifiers(identifierList);
		}

		const activeBan = banEntities.find((ban) => this.isBanActive(ban));

		return {
			isBanned: !!activeBan,
			banEntity: activeBan,
			showCard: !!activeBan && this.shouldShowBanCard(activeBan),
		};
	}

	private isBanActive(ban: BanEntity): boolean {
		// Checking if the ban is still active
		if (ban.expiresAt) {
			return new Date() < new Date(ban.expiresAt);
		}
		return true; // Permanenter Ban
	}

	private shouldShowBanCard(ban: BanEntity): boolean {
		// Later on we could Implement showing a Warning to a Suspected Cheater
		return ban.isActive;
	}

	private formatBanMessage(banInfo: BanCheckResult): string {
		if (!banInfo.banEntity) {
			return 'You are banned from this server.';
		}

		const ban = banInfo.banEntity;
		let message = `You are banned from this server.\nReason: ${ban.reason || 'No reason provided'}`;

		if (ban.expiresAt && ban.expiresAt > new Date()) {
			const expiryDate = new Date(ban.expiresAt).toLocaleString('en-US');
			message += `\nBan expires: ${expiryDate}`;
		} else {
			message += '\nThis ban is permanent.';
		}

		if (ban.note) {
			message += `\nNote: ${ban.note}`;
		}

		if (ban.bannedBy) {
			message += `\nBanned by: ${ban.bannedBy}`;
		}

		// Add appeal information
		const appealUrl = this.getAppealUrl();
		if (appealUrl) {
			message += `\nAppeal: ${appealUrl}`;
		}

		return message;
	}

	private async presentBanCard(deferrals: Deferrals, banInfo: BanCheckResult): Promise<void> {
		if (!banInfo.banEntity) return;

		const ban = banInfo.banEntity;
		const isPermanent = !ban.expiresAt || ban.expiresAt <= new Date();

		const cardData = {
			BAN_REASON: ban.reason || 'No reason provided',
			BAN_DATE: ban.createdAt ? new Date(ban.createdAt).toLocaleString('en-US') : 'Unknown',
			BAN_EXPIRES: isPermanent ? 'Permanent' : new Date(ban.expiresAt).toLocaleString('en-US'),
			BAN_EXPIRES_COLOR: isPermanent ? 'Attention' : 'Warning',
			BANNED_BY: ban.bannedBy || 'System',
			BAN_IDENTIFIER: ban.banIdentifier || ban.id?.toString() || 'N/A',
			IS_AUTOMATIC: ban.automatic ? 'Yes' : 'No',
			AUTOMATIC_COLOR: ban.automatic ? 'Attention' : 'Good',
			BAN_NOTE: ban.note || 'No additional notes',

			// Server Stats
			BANNED_PLAYERS: await this.getBannedPlayersCount(),
			ACTIVE_PLAYERS: await this.getActivePlayersCount(),

			// Support Links
			APPEAL_URL: this.getAppealUrl(),
			DISCORD_URL: this.getDiscordUrl(),
		};

		const card = replacePlaceholders(this._adaptiveCard, cardData);

		const cardDisplayTime = 12000;
		const startTime = Date.now();

		while (Date.now() - startTime < cardDisplayTime) {
			deferrals.presentCard(JSON.stringify(card), (data, rawData) => {
				//TODO: Find the reason why this wont work, clicks onto action buttons, dont trigger this callback
				this.logger.info(`Ban card interaction: ${JSON.stringify(data)}\nRaw: ${rawData}`);

				// Log appeals for analytics
				///@ts-expect-error
				if (data?.action === 'appeal') {
					this.logger.info(`Player ${source} clicked appeal link for ban ${ban.banIdentifier || ban.id}`);
					//TODO: Open Appeal Link
				}
			});
			await wait(150);
		}
	}

	private async finalizeConnection(deferrals: Deferrals): Promise<void> {
		deferrals.update('Finalizing connection...');
		await sleep(500); // Reduced wait time
		deferrals.done();
	}

	private async getBannedPlayersCount(): Promise<string> {
		try {
			const count = await this._banRepository.count();
			return count.toString();
		} catch {
			return 'N/A';
		}
	}

	// Additional helper methods for Ban Card
	private getAppealUrl(): string {
		// Configurable Appeal URL
		return process.env.APPEAL_URL || 'https://eterna.gg/appeal';
	}

	private getDiscordUrl(): string {
		// Configurable Discord URL
		return process.env.DISCORD_URL || 'https://discord.gg/eterna';
	}

	private async getActivePlayersCount(): Promise<string> {
		try {
			return GetNumPlayerIndices().toString();
		} catch {
			return 'N/A';
		}
	}
}
