export declare enum HardwareStatus {
    Online = "online",
    Busy = "busy",
    Offline = "offline"
}
export declare class Hardware {
    readonly id: string;
    readonly deviceIdentity: string;
    status: HardwareStatus;
    constructor(id: string, deviceIdentity: string, status: HardwareStatus);
}
