export declare enum DeviceStatus {
    Online = "online",
    Busy = "busy",
    Offline = "offline"
}
export declare class Device {
    readonly id: string;
    readonly deviceIdentity: string;
    status: DeviceStatus;
    constructor(id: string, deviceIdentity: string, status: DeviceStatus);
}
