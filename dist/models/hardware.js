export var HardwareStatus;
(function (HardwareStatus) {
    HardwareStatus["Online"] = "online";
    HardwareStatus["Busy"] = "busy";
    HardwareStatus["Offline"] = "offline";
})(HardwareStatus || (HardwareStatus = {}));
export class Hardware {
    id;
    deviceIdentity;
    status;
    constructor(id, deviceIdentity, status) {
        this.id = id;
        this.deviceIdentity = deviceIdentity;
        this.status = status;
    }
}
//# sourceMappingURL=hardware.js.map