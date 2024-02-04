import type { Hardware, UniError, User } from '.';

export enum P2PCallStatus {
    Pending = 'pending',
    Starting = 'starting',
    Active = 'active',
    Finished = 'finished',
    Failed = 'failed',
}

export class P2PCall {
    public error?: UniError;

    constructor(
        public readonly id: string,
        public readonly user: User,
        public readonly hardware: Hardware,
        public status: P2PCallStatus = P2PCallStatus.Pending
    ) {}
}
