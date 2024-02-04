export var P2PCallStatus;
(function (P2PCallStatus) {
    P2PCallStatus["Pending"] = "pending";
    P2PCallStatus["Starting"] = "starting";
    P2PCallStatus["Active"] = "active";
    P2PCallStatus["Finished"] = "finished";
    P2PCallStatus["Failed"] = "failed";
})(P2PCallStatus || (P2PCallStatus = {}));
export class P2PCall {
    id;
    user;
    hardware;
    status;
    error;
    constructor(id, user, hardware, status = P2PCallStatus.Pending) {
        this.id = id;
        this.user = user;
        this.hardware = hardware;
        this.status = status;
    }
}
//# sourceMappingURL=call.js.map