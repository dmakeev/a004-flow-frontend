export var UserStatus;
(function (UserStatus) {
    UserStatus["Online"] = "online";
    UserStatus["Away"] = "away";
    UserStatus["Busy"] = "busy";
    UserStatus["Offline"] = "offline";
})(UserStatus || (UserStatus = {}));
export class User {
    id;
    userIdentity;
    status = UserStatus.Offline;
    constructor(id, userIdentity) {
        this.id = id;
        this.userIdentity = userIdentity;
    }
}
//# sourceMappingURL=user.js.map