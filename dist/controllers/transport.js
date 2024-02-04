import { io, Socket } from 'socket.io-client';
import { Hardware, HardwareStatus } from '../models';
import { LogController } from './log';
export var SignalingEventType;
(function (SignalingEventType) {
    SignalingEventType["CONNECTED"] = "connected";
    SignalingEventType["DISCONNECTED"] = "disconnected";
    SignalingEventType["HARDWARE_ONLINE"] = "hardware_online";
    SignalingEventType["HARDWARE_OFFLINE"] = "hardware_offline";
    // INCOMING = 'incoming',
    SignalingEventType["ACCEPTED"] = "accepted";
    SignalingEventType["HANGUP"] = "hangup";
    SignalingEventType["INCOMING_ICE"] = "incoming_ice";
})(SignalingEventType || (SignalingEventType = {}));
export class TransportController {
    static instance;
    logController = LogController.Instance;
    eventListeners = new Map();
    connected = false;
    socket;
    userId;
    static get Instance() {
        return this.instance || (this.instance = new this());
    }
    constructor() {
        for (const v of Object.values(SignalingEventType)) {
            this.eventListeners.set(v, new Set());
        }
    }
    get hasConnection() {
        return this.connected;
    }
    addEventListener(type, listener) {
        this.eventListeners.get(type)?.add(listener);
    }
    removeEventListener(type, listener) {
        this.eventListeners.get(type)?.delete(listener);
    }
    /**
     * Connect to the signaling server
     *
     * @param {string} url
     * @returns {Promise<void>}
     */
    async connect(url) {
        return new Promise((resolve, reject) => {
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
            this.socket.on('connect_error', (error) => {
                this.connected = false;
                this.logController.log('Can`t connect to the signaling socket', error.message);
                reject(error);
            });
            this.socket.on('/v1/user/connected', () => {
                this.logController.log('Signaling socket is ready for use');
                this.eventListeners.get(SignalingEventType.CONNECTED)?.forEach((listener) => listener());
                resolve();
            });
            this.socket.on('/v1/hardware/is-online', (data) => {
                this.eventListeners.get(SignalingEventType.HARDWARE_ONLINE)?.forEach((listener) => listener({ hardware: data.hardware }));
            });
            this.socket.on('/v1/hardware/is-offline', (data) => {
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
            this.socket.on('/v1/p2p/accepted', (data) => {
                this.eventListeners
                    .get(SignalingEventType.ACCEPTED)
                    ?.forEach((listener) => listener({ callId: data.callId, sdpOffer: data.sdpOffer }));
            });
            this.socket.on('/v1/p2p/hangup', (data) => {
                this.eventListeners.get(SignalingEventType.HANGUP)?.forEach((listener) => listener({ callId: data.callId }));
            });
            this.socket.on('/v1/p2p/incoming_ice', (data) => {
                const formattedCandidate = new RTCIceCandidate({
                    sdpMLineIndex: data.candidate.sdpMLineIndex,
                    candidate: data.candidate.candidate,
                });
                this.eventListeners
                    .get(SignalingEventType.INCOMING_ICE)
                    ?.forEach((listener) => listener({ callId: data.callId, candidate: formattedCandidate }));
            });
        });
    }
    /**
     * Disconnect from the signaling server
     *
     * @returns {void}
     */
    disconnect() {
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
    async login(userIdentity, securityToken) {
        return new Promise((resolve, reject) => {
            if (!this.socket) {
                reject(new Error('Socket is not connected'));
                return;
            }
            if (this.userId) {
                reject(new Error('You are already logged in'));
                return;
            }
            this.socket.emit('/v1/user/login', { userIdentity, securityToken }, (data) => {
                if (!data || !!data.error || !data.user) {
                    reject(!!data.error ? new Error(data.error.reason) : new Error('Unknown error'));
                    return;
                }
                this.userId = data.user.id;
                // TODO: Make a correct object mapping
                resolve({ user: data.user, iceServers: data.iceServers ?? [] });
            });
        });
    }
    /**
     * Logout user
     *
     * @returns {Promise<void>}
     */
    async logout() {
        return new Promise((resolve, reject) => {
            if (!this.socket) {
                reject(new Error('Socket is not connected'));
                return;
            }
            this.socket.emit('/v1/user/logout', {}, (data) => {
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
    async getHardwareList() {
        return new Promise((resolve, reject) => {
            if (!this.socket) {
                reject(new Error('Socket is not connected'));
                return;
            }
            if (!this.userId) {
                reject(new Error('You should authenticate first'));
                return;
            }
            this.socket.emit('/v1/hardware/list', {}, (data) => {
                if (!!data.error) {
                    reject(new Error(data.error.reason));
                    return;
                }
                const hardwareList = data.hardwares.map((item) => {
                    return new Hardware(item.id, item.deviceIdentity, item.status);
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
     * sdpOffer: RTCSessionDescription,
     * @param {boolean}               audio     If audio should be enabled
     * @param {boolean}               video     If video should be enabled
     * @returns {Promise<string>}               Call ID
     */
    async call(hardwareId, audio, video) {
        return new Promise((resolve, reject) => {
            if (!this.socket) {
                reject(new Error('Socket is not connected'));
                return;
            }
            if (!this.userId) {
                reject(new Error('You should authenticate first'));
                return;
            }
            // sdpOffer,
            this.socket.emit('/v1/p2p/start', { hardwareId, audio, video }, (data) => {
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
    async toggleIncomingMedia(callId, audio, video) {
        return new Promise((resolve, reject) => {
            if (!this.socket) {
                reject(new Error('Socket is not connected'));
                return;
            }
            if (!this.userId) {
                reject(new Error('You should authenticate first'));
                return;
            }
            this.socket.emit('/v1/p2p/incoming-media-toggle', { callId, audio, video }, (data) => {
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
    async hangup(callId, reason) {
        return new Promise((resolve, reject) => {
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
    async reconnect(callId, sdpOffer) {
        return new Promise((resolve, reject) => {
            if (!this.socket) {
                reject(new Error('Socket is not connected'));
                return;
            }
            if (!this.userId) {
                reject(new Error('You should authenticate first'));
                return;
            }
            this.socket.emit('/v1/p2p/reconnect', { callId, sdpOffer }, (data) => {
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
    async acceptReconnect(callId, sdpAnswer) {
        return new Promise((resolve, reject) => {
            if (!this.socket) {
                reject(new Error('Socket is not connected'));
                return;
            }
            if (!this.userId) {
                reject(new Error('You should authenticate first'));
                return;
            }
            this.socket.emit('/v1/p2p/accept-reconnect', { callId, sdpAnswer }, (data) => {
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
    async sendSDPAnswer(callId, sdpAnswer) {
        return new Promise((resolve, reject) => {
            if (!this.socket) {
                reject(new Error('Socket is not connected'));
                return;
            }
            if (!this.userId) {
                reject(new Error('You should authenticate first'));
                return;
            }
            this.socket.emit('/v1/p2p/answer', { callId, sdpAnswer }, (data) => {
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
    async sendIceCandidate(callId, candidate) {
        return new Promise((resolve, reject) => {
            if (!this.socket) {
                reject(new Error('Socket is not connected'));
                return;
            }
            if (!this.userId) {
                reject(new Error('You should authenticate first'));
                return;
            }
            this.socket.emit('/v1/p2p/ice', { callId, candidate }, (data) => {
                if (!!data.error || !callId) {
                    reject(new Error(data.error?.reason ?? 'Unknown error'));
                    return;
                }
                resolve();
            });
        });
    }
}
//# sourceMappingURL=transport.js.map