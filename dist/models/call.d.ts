import type { Hardware, UniError, User } from '.';
export declare enum P2PCallStatus {
    Pending = "pending",
    Starting = "starting",
    Active = "active",
    Finished = "finished",
    Failed = "failed"
}
export declare class P2PCall {
    readonly id: string;
    readonly user: User;
    readonly hardware: Hardware;
    status: P2PCallStatus;
    error?: UniError;
    constructor(id: string, user: User, hardware: Hardware, status?: P2PCallStatus);
}
