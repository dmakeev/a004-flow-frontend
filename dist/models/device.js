export var DeviceStatus;
(function (DeviceStatus) {
    DeviceStatus["Online"] = "online";
    DeviceStatus["Busy"] = "busy";
    DeviceStatus["Offline"] = "offline";
})(DeviceStatus || (DeviceStatus = {}));
export class Device {
    id;
    deviceIdentity;
    status;
    constructor(id, deviceIdentity, status) {
        this.id = id;
        this.deviceIdentity = deviceIdentity;
        this.status = status;
    }
}
//# sourceMappingURL=device.js.map