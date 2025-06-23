import { BanEntity } from '../../service/Database/entities/BanEntity';

export interface Deferrals {
	defer: () => void;
	update: (message: string) => void;
	presentCard: (card: Object | string, cb?: (data: object, rawData: string) => void) => void;
	done: (failureReason?: string) => void;
}

export interface PlayerIdentifiers {
	license: string | null;
	steam: string;
	hwid: string | null;
	ip: string | null;
}

export interface BanCheckResult {
	isBanned: boolean;
	banEntity?: BanEntity;
	showCard: boolean;
}

export interface SteamProfileResult {
	isOld: boolean;
	vacBanned?: boolean;
	noPublic?: boolean;
	message?: string;
}

export interface SteamPlayerData {
	timecreated?: number;
	// Add other relevant fields as needed
}

export interface SteamBanData {
	VACBanned: boolean;
	NumberOfVACBans: number;
	// Add other relevant fields as needed
}
