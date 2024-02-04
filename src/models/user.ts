export enum UserStatus {
    Online = 'online',
    Away = 'away',
    Busy = 'busy',
    Offline = 'offline',
}

export class User {
    public status: UserStatus = UserStatus.Offline;
    constructor(public readonly id: string, public readonly userIdentity: string) {}
}
