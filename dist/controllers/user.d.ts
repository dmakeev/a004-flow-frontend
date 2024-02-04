import { User } from '../models';
export declare class UserController {
    private transport;
    private _user?;
    get user(): User | undefined;
    /**
     * Login user to the signaling server
     *
     * @param {string} userIdentity User ID
     * @param {string} securityToken Any security token, used by the backend to authorize user
     * @returns {Promise<User>}
     */
    login(userIdentity: string, securityToken: string): Promise<{
        user: User;
        iceServers: [];
    }>;
    /**
     * Logout user
     *
     * @returns {Promise<void>}
     */
    logout(): Promise<void>;
}
