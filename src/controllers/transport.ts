import { io, Socket } from 'socket.io-client';
import { Hardware, HardwareStatus, type P2PCall, type UniError, type User } from '../models';

import { LogController } from './log';

export enum SignalingEventType {
    CONNECTED = 'connected',
    DISCONNECTED = 'disconnected',
    HARDWARE_ONLINE = 'hardware_online',
    HARDWARE_OFFLINE = 'hardware_offline',
    // INCOMING = 'incoming',
    ACCEPTED = 'accepted',
    HANGUP = 'hangup',
    INCOMING_ICE = 'incoming_ice',
}

export type SignalingEvent = (data?: any) => void;

export class TransportController {
    private static instance: TransportController;
    private readonly logController: LogController = LogController.Instance;
    private readonly eventListeners: Map<SignalingEventType, Set<SignalingEvent>> = new Map<SignalingEventType, Set<SignalingEvent>>();

    private connected: boolean = false;
    private socket?: Socket;
    private userId?: string;

    public static get Instance(): TransportController {
        return this.instance || (this.instance = new this());
    }

    constructor() {
        for (const v of Object.values(SignalingEventType)) {
            this.eventListeners.set(v, new Set());
        }
    }

    public get hasConnection(): boolean {
        return this.connected;
    }

    public addEventListener(type: SignalingEventType, listener: SignalingEvent): void {
        this.eventListeners.get(type)?.add(listener);
    }

    public removeEventListener(type: SignalingEventType, listener: SignalingEvent): void {
        this.eventListeners.get(type)?.delete(listener);
    }

    /**
     * Connect to the signaling server
     *
     * @param {string} url
     * @returns {Promise<void>}
     */
    public async connect(url: string): Promise<void> {
        return new Promise((resolve: (value: void) => void, reject: (error: Error) => void) => {
            if (!!this.socket) {
                this.disconnect();
            }
            this.socket = io(url, { path: '/signal/socket.io', transports: ['websocket'] });

            this.socket.on('connect', () => {
                this.logController.log('Signaling socket is connected');
            });

            this.socket.on('disconnect', () => {
                this.connected = false;
                this.logController.log('Signaling socket is disconnected');
            });

            this.socket.on('connect_error', (error: Error) => {
                this.connected = false;
                this.logController.log('Can`t connect to the signaling socket', error.message);
                reject(error);
            });

            this.socket.on('/v1/user/connected', () => {
                this.logController.log('Signaling socket is ready for use');
                this.eventListeners.get(SignalingEventType.CONNECTED)?.forEach((listener) => listener());
                resolve();
            });

            this.socket.on('/v1/hardware/is-online', (data: { hardware: Hardware }) => {
                this.eventListeners.get(SignalingEventType.HARDWARE_ONLINE)?.forEach((listener) => listener({ hardware: data.hardware }));
            });

            this.socket.on('/v1/hardware/is-offline', (data: { hardware: Hardware }) => {
                this.eventListeners.get(SignalingEventType.HARDWARE_OFFLINE)?.forEach((listener) => listener({ hardware: data.hardware }));
            });

            /*
            this.socket.on('/v1/p2p/incoming', (data: { call: P2PCall; sdpOffer: RTCSessionDescription }) => {
                this.eventListeners
                    .get(SignalingEventType.INCOMING)
                    ?.forEach((listener: (data: { call: P2PCall; sdpOffer: RTCSessionDescription }) => void) =>
                        listener({ call: data.call, sdpOffer: data.sdpOffer })
                    );
            });
            */

            this.socket.on('/v1/p2p/accepted', (data: { callId: string; sdpOffer: RTCSessionDescription }) => {
                this.eventListeners
                    .get(SignalingEventType.ACCEPTED)
                    ?.forEach((listener) => listener({ callId: data.callId, sdpOffer: data.sdpOffer }));
            });

            this.socket.on('/v1/p2p/hangup', (data: { callId: string }) => {
                this.eventListeners.get(SignalingEventType.HANGUP)?.forEach((listener) => listener({ callId: data.callId }));
            });

            this.socket.on('/v1/p2p/incoming_ice', (data: { callId: string; candidate: { sdpMLineIndex: number; candidate: string } }) => {
                const formattedCandidate: RTCIceCandidate = new RTCIceCandidate({
                    sdpMLineIndex: data.candidate.sdpMLineIndex,
                    candidate: data.candidate.candidate,
                });
                this.eventListeners
                    .get(SignalingEventType.INCOMING_ICE)
                    ?.forEach((listener: (data: { callId: string; candidate: RTCIceCandidate }) => void) =>
                        listener({ callId: data.callId, candidate: formattedCandidate })
                    );
            });
        });
    }
    /**
     * Disconnect from the signaling server
     *
     * @returns {void}
     */
    public disconnect(): void {
        this.logout();
        this.connected = false;
        if (!!this.socket) {
            this.socket.close();
            this.socket = undefined;
        }
    }

    /**
     * Login user to the signaling server
     *
     * @param {string} userIdentity User ID
     * @param {string} securityToken Any security token, used by the backend to authorize user
     * @returns {Promise<User>}
     */
    public async login(userIdentity: string, securityToken: string): Promise<{ user: User; iceServers: [] }> {
        return new Promise((resolve: (data: { user: User; iceServers: [] }) => void, reject: (error: Error) => void) => {
            if (!this.socket) {
                reject(new Error('Socket is not connected'));
                return;
            }
            if (this.userId) {
                reject(new Error('You are already logged in'));
                return;
            }
            this.socket.emit(
                '/v1/user/login',
                { userIdentity, securityToken },
                (data: { error?: UniError; iceServers?: []; user?: User }) => {
                    if (!data || !!data.error || !data.user) {
                        reject(!!data.error ? new Error(data.error.reason) : new Error('Unknown error'));
                        return;
                    }
                    this.userId = data.user.id;
                    // TODO: Make a correct object mapping
                    resolve({ user: data.user, iceServers: data.iceServers ?? [] });
                }
            );
        });
    }

    /**
     * Logout user
     *
     * @returns {Promise<void>}
     */
    public async logout(): Promise<void> {
        return new Promise((resolve: (value: void) => void, reject: (error: Error) => void) => {
            if (!this.socket) {
                reject(new Error('Socket is not connected'));
                return;
            }
            this.socket.emit('/v1/user/logout', {}, (data: { error?: UniError }) => {
                if (!!data.error) {
                    reject(new Error(data.error.reason));
                    return;
                }
                resolve();
            });
        });
    }

    /**
     * Start pairing process
     *
     */
    public async getHardwareList(): Promise<Hardware[]> {
        return new Promise((resolve: (hardwareList: Hardware[]) => void, reject: (error: Error) => void) => {
            if (!this.socket) {
                reject(new Error('Socket is not connected'));
                return;
            }
            if (!this.userId) {
                reject(new Error('You should authenticate first'));
                return;
            }
            this.socket.emit('/v1/hardware/list', {}, (data: { error?: UniError; hardwares: Hardware[] }) => {
                if (!!data.error) {
                    reject(new Error(data.error.reason));
                    return;
                }
                const hardwareList: Hardware[] = data.hardwares.map((item: Hardware) => {
                    return new Hardware(item.id, item.deviceIdentity, item.status as HardwareStatus);
                });
                resolve(hardwareList);
            });
        });
    }

    /**
     * Start new call
     *
     * @param {string}                hardwareId  User ID to call to
     * @param {RTCSessionDescription} sdpOffer  Any security token, used by the backend to authorize user
     * @param {boolean}               audio     If audio should be enabled
     * @param {boolean}               video     If video should be enabled
     * @returns {Promise<string>}               Call ID
     */
    public async call(hardwareId: string, audio: boolean, video: boolean): Promise<P2PCall> {
        return new Promise((resolve: (call: P2PCall) => void, reject: (error: Error) => void) => {
            if (!this.socket) {
                reject(new Error('Socket is not connected'));
                return;
            }
            if (!this.userId) {
                reject(new Error('You should authenticate first'));
                return;
            }
            this.socket.emit('/v1/p2p/start', { hardwareId, audio, video }, (data: { error?: UniError; call?: P2PCall }) => {
                if (!!data.error || !data.call) {
                    reject(!!data.error ? new Error(data.error.reason) : new Error('Unknown error'));
                    return;
                }
                resolve(data.call);
            });
        });
    }

    /**
     * Start new call
     *
     * @param {string}                callId  User ID to call to
     * @param {boolean}               enabled If audio enabled or not
     * @returns {Promise<void>}
     */
    public async toggleIncomingMedia(callId: string, audio: boolean, video: boolean): Promise<void> {
        return new Promise((resolve: () => void, reject: (error: Error) => void) => {
            if (!this.socket) {
                reject(new Error('Socket is not connected'));
                return;
            }
            if (!this.userId) {
                reject(new Error('You should authenticate first'));
                return;
            }
            this.socket.emit('/v1/p2p/incoming-media-toggle', { callId, audio, video }, (data: { error?: UniError }) => {
                if (!!data.error) {
                    reject(!!data.error ? new Error(data.error.reason) : new Error('Unknown error'));
                    return;
                }
                resolve();
            });
        });
    }

    /**
     * Accept the call
     *
     * @param {string}                calleeId  User ID to call to
     * @param {RTCSessionDescription} sdpOffer  Any security token, used by the backend to authorize user
     * @param {boolean}               audio     If audio should be enabled
     * @param {boolean}               video     If video should be enabled
     * @returns {Promise<void>}               Call ID
     */
    /*
    public async accept(callId: string, sdpAnswer: RTCSessionDescription, audio: boolean, video: boolean): Promise<P2PCall> {
        return new Promise((resolve: (call: P2PCall) => void, reject: (error: Error) => void) => {
            if (!this.socket) {
                reject(new Error('Socket is not connected'));
                return;
            }
            if (!this.userId) {
                reject(new Error('You should authenticate first'));
                return;
            }
            this.socket.emit('/v1/p2p/accept', { callId, sdpAnswer, audio, video }, (data: { error?: UniError; call?: P2PCall }) => {
                if (!!data.error || !data.call) {
                    reject(!!data.error ? new Error(data.error.reason) : new Error('Unknown error'));
                    return;
                }
                resolve(data.call);
            });
        });
    }
    */

    /**
     * Reject the incoming call
     *
     * @param {string}  callId  User ID to call to
     * @param {string?} reason  Optional reason of rejecting the call - will be delivered to caller's device
     * @returns {Promise<void>}
     */
    /*
    public async reject(callId: string, reason?: string): Promise<void> {
        return new Promise((resolve: (value: void) => void, reject: (error: Error) => void) => {
            if (!this.socket) {
                reject(new Error('Socket is not connected'));
                return;
            }
            if (!this.userId) {
                reject(new Error('You should authenticate first'));
                return;
            }
            this.socket.emit('/v1/p2p/reject', { callId, reason }, (data: { error?: UniError }) => {
                if (!!data.error) {
                    reject(new Error(data.error.reason));
                    return;
                }
                resolve();
            });
        });
    }
    */

    /**
     * Hangup the call
     *
     * @param {string}  callId  User ID to call to
     * @param {string?} reason  Optional reason of rejecting the call - will be delivered to caller's device
     * @returns {Promise<void>}
     */
    public async hangup(callId: string, reason?: string): Promise<void> {
        return new Promise((resolve: (value: void) => void, reject: (error: Error) => void) => {
            if (!this.socket) {
                reject(new Error('Socket is not connected'));
                return;
            }
            if (!this.userId) {
                reject(new Error('You should authenticate first'));
                return;
            }
            this.socket.emit('/v1/p2p/hangup', { callId, reason });
            resolve();
        });
    }

    /**
     * Reconnect the call
     *
     * @param {string}                callId  User ID to call to
     * @param {RTCSessionDescription} sdpOffer  Any security token, used by the backend to authorize user
     * @returns {Promise<void>}
     */
    public async reconnect(callId: string, sdpOffer: RTCSessionDescription): Promise<void> {
        return new Promise((resolve: (value: void) => void, reject: (error: Error) => void) => {
            if (!this.socket) {
                reject(new Error('Socket is not connected'));
                return;
            }
            if (!this.userId) {
                reject(new Error('You should authenticate first'));
                return;
            }
            this.socket.emit('/v1/p2p/reconnect', { callId, sdpOffer }, (data: { error?: UniError }) => {
                if (!!data.error || !callId) {
                    reject(new Error(data.error?.reason ?? 'Unknown error'));
                    return;
                }
                resolve();
            });
        });
    }

    /**
     * Accept the reconnection request
     *
     * @param {string}                callId  User ID to call to
     * @param {RTCSessionDescription} sdpAnswer  Any security token, used by the backend to authorize user
     * @returns {Promise<void>}
     */
    public async acceptReconnect(callId: string, sdpAnswer: RTCSessionDescription): Promise<void> {
        return new Promise((resolve: (value: void) => void, reject: (error: Error) => void) => {
            if (!this.socket) {
                reject(new Error('Socket is not connected'));
                return;
            }
            if (!this.userId) {
                reject(new Error('You should authenticate first'));
                return;
            }
            this.socket.emit('/v1/p2p/accept-reconnect', { callId, sdpAnswer }, (data: { error: UniError }) => {
                if (!!data.error || !callId) {
                    reject(new Error(data.error?.reason ?? 'Unknown error'));
                    return;
                }
                resolve();
            });
        });
    }

    /**
     * Send SDP Answer to another user
     *
     * @param {string}                callId  User ID to call to
     * @param {RTCSessionDescription} sdpAnswer  Any security token, used by the backend to authorize user
     * @returns {Promise<void>}
     */
    public async sendSDPAnswer(callId: string, sdpAnswer: RTCSessionDescription): Promise<void> {
        return new Promise((resolve: (value: void) => void, reject: (error: Error) => void) => {
            if (!this.socket) {
                reject(new Error('Socket is not connected'));
                return;
            }
            if (!this.userId) {
                reject(new Error('You should authenticate first'));
                return;
            }
            this.socket.emit('/v1/p2p/answer', { callId, sdpAnswer }, (data: { error: UniError }) => {
                if (!!data.error || !callId) {
                    reject(new Error(data.error?.reason ?? 'Unknown error'));
                    return;
                }
                resolve();
            });
        });
    }

    /**
     * Send ICE candidate to another user
     *
     * @param {string}                callId  User ID to call to
     * @param {RTCIceCandidate}       candidate  Any security token, used by the backend to authorize user
     * @returns {Promise<void>}
     */
    public async sendIceCandidate(callId: string, candidate: RTCIceCandidate): Promise<void> {
        return new Promise((resolve: (value: void) => void, reject: (error: Error) => void) => {
            if (!this.socket) {
                reject(new Error('Socket is not connected'));
                return;
            }
            if (!this.userId) {
                reject(new Error('You should authenticate first'));
                return;
            }
            this.socket.emit('/v1/p2p/ice', { callId, candidate }, (data: { error: UniError }) => {
                if (!!data.error || !callId) {
                    reject(new Error(data.error?.reason ?? 'Unknown error'));
                    return;
                }
                resolve();
            });
        });
    }
}
