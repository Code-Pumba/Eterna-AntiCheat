import { BaseController } from '..';
import { ControllerConfig, ControllerType } from '../data';

export class PlayerConnectController extends BaseController {
	public override readonly controllerIdentifier = 'playerConnect';
	public override readonly eventName = 'playerConnecting';
	public override readonly type = ControllerType.EVENT;

	public override readonly config: ControllerConfig = {
		timeout: 10000,
		autoStart: false,
	};

	public override async onControllerEnable(): Promise<void> {}
	public override async onControllerDisable(): Promise<void> {}
	public override async onHealthCheck(): Promise<boolean> {
		return true;
	}

	public override async onEventHandler(name: string, setKickReason: (reason: string) => void, deferrals: any): Promise<void> {}
}
