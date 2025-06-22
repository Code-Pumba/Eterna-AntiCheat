export interface Deferrals {
	defer: () => void;
	update: (message: string) => void;
	presentCard: (card: Object | string, cb?: (data: object, rawData: string) => void) => void;
	done: (failureReason?: string) => void;
}
