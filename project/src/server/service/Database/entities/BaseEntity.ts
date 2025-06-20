export abstract class BaseEntity {
	public id: number;
	public createdAt: Date;
	public updatedAt: Date;

	public constructor(id: number) {
		this.id = id;
		this.createdAt = new Date();
		this.updatedAt = new Date();
	}

	public update() {
		this.updatedAt = new Date();
	}

	public abstract toObject(): Record<string, any>;

	public abstract toString(): string;

	public abstract toJSON(): Record<string, any>;
}
