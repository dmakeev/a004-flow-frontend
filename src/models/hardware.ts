export enum HardwareStatus {
    Online = 'online',
    Busy = 'busy',
    Offline = 'offline',
}

export class Hardware {
    constructor(public readonly id: string, public readonly deviceIdentity: string, public status: HardwareStatus) {}
}
