import { BaseEntity } from './BaseEntity';

export interface IBanEntity {
	id: number;
	reason: string;
	bannedBy: string;
	identifier: string[];
	ipAdress: string | null;
	hwidHash: string;
	expiresAt: Date;
	isActive: boolean;
	note: string | null;
	automatic: boolean;
	banIdentifier: string;
	evidenceUrls: string[];
}

export class BanEntity extends BaseEntity {
	public reason: string;
	public bannedBy: string;
	public identifier: string[];
	public ipAdress: string | null;
	public hwidHash: string;
	public expiresAt: Date;
	public isActive: boolean;
	public note: string | null;
	public automatic: boolean;
	public banIdentifier: string;
	public evidenceUrls: string[];

	public constructor(id: number, entity?: IBanEntity) {
		super(entity?.id ?? id);

		this.reason = entity?.reason ?? '';
		this.bannedBy = entity?.bannedBy ?? '';
		this.identifier = entity?.identifier ?? [];
		this.ipAdress = entity?.ipAdress ?? null;
		this.hwidHash = entity?.hwidHash ?? '';
		this.expiresAt = entity?.expiresAt ?? new Date();
		this.isActive = entity?.isActive ?? false;
		this.note = entity?.note ?? null;
		this.automatic = entity?.automatic ?? false;
		this.banIdentifier = entity?.banIdentifier ?? '';
		this.evidenceUrls = entity?.evidenceUrls ?? [];
	}

	protected override toString(): string {
		return `
			id: ${this.id},
			reason: ${this.reason},
			bannedBy: ${this.bannedBy},
			identifier: ${this.identifier},
			ipAdress: ${this.ipAdress},
			hwidHash: ${this.hwidHash},
			expiresAt: ${this.expiresAt},
			isActive: ${this.isActive},
			note: ${this.note},
			automatic: ${this.automatic},
			banIdentifier: ${this.banIdentifier},
			evidenceUrls: ${this.evidenceUrls}
		`;
	}

	protected override toObject(): Record<string, any> {
		return {
			id: this.id,
			reason: this.reason,
			bannedBy: this.bannedBy,
			identifier: this.identifier,
			ipAdress: this.ipAdress,
			hwidHash: this.hwidHash,
			expiresAt: this.expiresAt,
			isActive: this.isActive,
			note: this.note,
			automatic: this.automatic,
			banIdentifier: this.banIdentifier,
			evidenceUrls: this.evidenceUrls,
		};
	}

	protected override toJSON(): string {
		return JSON.stringify(this.toObject());
	}
}
