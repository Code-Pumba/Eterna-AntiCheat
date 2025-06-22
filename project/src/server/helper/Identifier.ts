// Always Return Identifier without the "prefix:" prefix
export const getLicenseIdentifier = (source: number): string => {
	return GetPlayerIdentifierByType(source.toString(), 'license2').replace('license2:', '');
};

export const getPlayerHardwareId = (source: number): string => {
	return GetPlayerToken(source.toString(), 2);
};

export const getPlayerDiscordId = (source: number): string => {
	return GetPlayerIdentifierByType(source.toString(), 'discord').replace('discord:', '');
};

export const getPlayerIp = (source: number): string => {
	return GetPlayerEndpoint(source.toString());
};

// Returns the Steam Hex Identifier
export const getSteamHexIdentifier = (source: number): string => {
	const steam = GetPlayerIdentifierByType(source.toString(), 'steam').replace('steam:', '');
	return BigInt('0x' + steam).toString();
};

// Probably Deprecated
export const getPlayerXblId = (source: number): string => {
	return GetPlayerIdentifierByType(source.toString(), 'xbl').replace('xbl:', '');
};

// Probably Deprecated
export const getPlayerLiveId = (source: number): string => {
	return GetPlayerIdentifierByType(source.toString(), 'live').replace('live:', '');
};
