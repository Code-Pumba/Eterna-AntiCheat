import { IListener } from './listener';

const registeredEvents: Map<string, Event> = new Map();

export abstract class Event implements IListener {
	// Event String - Maybe Hash the Event for more Protection
	private readonly event: string;

	constructor(event: string, net: boolean = false) {
		if (registeredEvents.has(event)) {
			// Replace with Custom Logger and Monitoring
			console.log(`[EAntiCheat] This Event was already Registered, we dont allow Overriding this Feature. EVENT - ${event}`);
			return;
		}

		this.event = event;
		registeredEvents.set(event, this);
		addEventListener(event, this.eventHandler.bind(this), net);
	}

	abstract onEnable(): Promise<void> | void;

	abstract onDisable(): Promise<void> | void;

	abstract eventHandler(): Promise<void> | void;
}
