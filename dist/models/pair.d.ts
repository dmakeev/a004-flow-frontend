import { User } from './user';
export declare class UserPairInfo {
    readonly id: string;
    readonly caller: User;
    readonly callee: User;
    constructor(id: string, caller: User, callee: User);
}
