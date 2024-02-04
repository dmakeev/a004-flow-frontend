export declare enum UserStatus {
    Online = "online",
    Away = "away",
    Busy = "busy",
    Offline = "offline"
}
export declare class User {
    readonly id: string;
    readonly userIdentity: string;
    status: UserStatus;
    constructor(id: string, userIdentity: string);
}
