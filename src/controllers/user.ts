import { User } from '../models';
import { TransportController } from './transport';

export class UserController {
    private transport: TransportController = TransportController.Instance;
    private _user?: User;

    public get user(): User | undefined {
        return this._user;
    }

    /**
     * Login user to the signaling server
     *
     * @param {string} userIdentity User ID
     * @param {string} securityToken Any security token, used by the backend to authorize user
     * @returns {Promise<User>}
     */
    public async login(userIdentity: string, securityToken: string): Promise<{ user: User; iceServers: [] }> {
        return new Promise((resolve: (daata: { user: User; iceServers: [] }) => void, reject: (reason: string) => void) => {
            this.transport
                .login(userIdentity, securityToken)
                .then((data: { user: User; iceServers: [] }) => {
                    this._user = data.user; // new User(user.id, userIdentity);
                    resolve(data);
                })
                .catch((reasoon: string) => {
                    reject(reasoon);
                });
        });
    }

    /**
     * Logout user
     *
     * @returns {Promise<void>}
     */
    public async logout(): Promise<void> {
        return new Promise((resolve: (value: void) => void, reject: (reason: string) => void) => {
            this.transport
                .logout()
                .then(() => {
                    this._user = undefined;
                    resolve();
                })
                .catch((reasoon: string) => {
                    reject(reasoon);
                });
        });
    }
}
