import { Hardware, P2PCall, P2PCallStatus, type User } from '../models';
import { SignalingEventType, TransportController } from './transport';
import { UserController } from './user';
import { WebRTCController, WebRTCEventType } from './webrtc';

export enum P2PCallEventType {
    SIGNALING_CONNECTED = 'signaling_connected',
    HARDWARE_ONLINE = 'hardware_online',
    HARDWARE_OFFLINE = 'hardware_offline',
    // LOCAL_STREAM = 'local_stream',
    REMOTE_STREAM = 'remote_stream',
    HANGUP = 'hangup',
    ERROR = 'error',
}

export type P2PCallEvent = (data?: any) => void;

type IncomingCall = {
    call: P2PCall;
    sdpOffer: RTCSessionDescription;
};

export class P2PCallController {
    private call?: P2PCall;
    private readonly transport: TransportController = TransportController.Instance;
    private readonly eventListeners: Map<P2PCallEventType, Set<P2PCallEvent>> = new Map<P2PCallEventType, Set<P2PCallEvent>>();
    private readonly userController: UserController = new UserController();
    private readonly webrtcController: WebRTCController = new WebRTCController();
    private incomingCalls: Map<string, IncomingCall> = new Map<string, IncomingCall>();
    private static instance: P2PCallController;
    private sendAudio: boolean = false;
    private receiveAudio: boolean = false;
    private receiveVideo: boolean = false;

    /**
     * Returns active call, if any
     *
     * @returns {P2PCall | undefined}
     */
    public get currentCall(): P2PCall | undefined {
        return this.call;
    }

    /**
     * Returns current user, if any
     *
     * @returns {User | undefined}
     */
    public get currentUser(): User | undefined {
        return this.userController.user;
    }

    /**
     * Check if connection to the signaling server is active
     *
     * @returns {boolean}
     */
    public get signalingConnected(): boolean {
        return this.transport.hasConnection;
    }

    /**
     * Singletone
     *
     * @returns {P2PCallController}
     */
    public static getInstance(): P2PCallController {
        return this.instance || (this.instance = new this());
    }

    constructor() {
        for (const v of Object.values(P2PCallEventType)) {
            this.eventListeners.set(v, new Set());
        }

        // We receive a message from the signaling server about new pair
        this.transport.addEventListener(SignalingEventType.HARDWARE_ONLINE, (data: { hardware: Hardware }) => {
            this.eventListeners.get(P2PCallEventType.HARDWARE_ONLINE)?.forEach((listener) => listener(data));
        });
        // Active pairing was cancelled by another user
        this.transport.addEventListener(SignalingEventType.HARDWARE_OFFLINE, (data: { hardware: Hardware }) => {
            if (this.call?.hardware.id === data.hardware.id) {
                this.call = undefined;
            }
            this.eventListeners.get(P2PCallEventType.HARDWARE_OFFLINE)?.forEach((listener) => listener(data));
        });
        // New incoming call
        /*
        this.transport.addEventListener(SignalingEventType.INCOMING, (data: { call: P2PCall; sdpOffer: RTCSessionDescription }) => {
            this.incomingCalls.set(data.call.id, data);
            this.eventListeners.get(P2PCallEventType.INCOMING)?.forEach((listener) => listener({ call: data.call }));
        });
        */
        // Call was hanged up
        this.transport.addEventListener(SignalingEventType.HANGUP, (data: { callId: string }) => {
            this.call = undefined;
            this.eventListeners.get(P2PCallEventType.HANGUP)?.forEach((listener) => listener(data));
            this.webrtcController.closeConnection();
        });
        // Local MediaStream is ready
        //this.webrtcController.addEventListener(WebRTCEventType.LOCAL_STREAM, (data: { stream: MediaStream }) => {
        // this.eventListeners.get(P2PCallEventType.LOCAL_STREAM)?.forEach((listener) => listener(data));
        //});
        // Remote MediaStream is ready
        this.webrtcController.addEventListener(WebRTCEventType.REMOTE_STREAM, (data: { stream: MediaStream }) => {
            this.eventListeners.get(P2PCallEventType.REMOTE_STREAM)?.forEach((listener) => listener(data));
        });
        // Your outgoing call was accepted
        this.transport.addEventListener(SignalingEventType.ACCEPTED, (data: { callId: string; sdpOffer: RTCSessionDescription }) => {
            this.webrtcController.callStarted();
            // Init connection with audio and without video
            this.webrtcController
                .initConnectionAnswering(data.sdpOffer, this.sendAudio)
                .then((sdpAnswer: RTCSessionDescription) => {
                    this.transport.sendSDPAnswer(data.callId, sdpAnswer).catch((error: Error) => console.error(error));
                })
                .catch((error: Error) => console.error(error));
        });
        // Incoming ICE candidate
        this.transport.addEventListener(SignalingEventType.INCOMING_ICE, (data: { callId: string; candidate: RTCIceCandidate }) => {
            if (data.callId === this.call?.id) {
                this.webrtcController.addCandidate(data.candidate);
            } else {
                console.warn('Incoming candidate for incorrect call');
            }
        });
        // New local ICE candidate was generated
        this.webrtcController.addEventListener(WebRTCEventType.ON_ICE_CANDIDATE, (data: { candidate: RTCIceCandidate }) => {
            if (!this.call) {
                return;
            }
            this.transport.sendIceCandidate(this.call!.id, data.candidate);
        });
    }

    public addEventListener(type: P2PCallEventType, listener: P2PCallEvent): void {
        this.eventListeners.get(type)?.add(listener);
    }

    public removeEventListener(type: P2PCallEventType, listener: P2PCallEvent): void {
        this.eventListeners.get(type)?.delete(listener);
    }

    /**
     * Connect to the signaling server
     *
     * @param {string} url  Url of the signaling server to connect to
     *
     */
    public async connect(url: string): Promise<void> {
        return this.transport
            .connect(url)
            .then(() => {
                this.eventListeners.get(P2PCallEventType.SIGNALING_CONNECTED)?.forEach((listener) => listener());
            })
            .catch((error: Error) => {
                this.eventListeners.get(P2PCallEventType.ERROR)?.forEach((listener) => listener(error));
            });
    }

    /**
     * Disconnect from the signaling server
     *
     *
     */
    public disconnect(): void {
        return this.transport.disconnect();
    }

    /**
     * Login user to the signaling server
     *
     * @param {string} userIdentity User ID
     * @param {string} securityToken Any security token, used by the backend to authorize user
     * @returns {Promise<User>}
     */
    public async login(userIdentity: string, securityToken: string): Promise<User> {
        return new Promise((resolve: (user: User) => void, reject: (error: Error) => void) => {
            this.userController
                .login(userIdentity, securityToken)
                .then((data: { user: User; iceServers: [] }) => {
                    resolve(data.user);
                    this.webrtcController.setIceServers(data.iceServers);
                })
                .catch((error: Error) => {
                    reject(new Error(error.message));
                });
        });
    }

    /**
     * Logout user
     *
     * @returns {Promise<void>}
     */
    public async logout(): Promise<void> {
        return this.userController.logout();
    }

    /**
     * Start pairing process
     *
     * @returns {Promise<void>}
     */
    public getHardwareList(): Promise<Hardware[]> {
        return this.transport.getHardwareList();
    }

    /**
     * Start a new call
     *
     * @param {string}  deviceId        Id of user to call to
     * @param {boolean} receiveAudio    Should the incoming audio be enabled by default
     * @param {boolean} receiveVideo    Should the incoming video be enabled by default
     * @param {boolean} sendAudio       Should the outgoing audio be enabled by default
     * @returns {Promise<P2PCall>}
     */
    public async startCall(deviceId: string, receiveAudio: boolean, receiveVideo: boolean, sendAudio: boolean): Promise<P2PCall> {
        this.receiveAudio = receiveAudio;
        this.receiveVideo = receiveVideo;
        this.sendAudio = sendAudio;
        return new Promise(async (resolve: (call: P2PCall) => void, reject: (error: Error) => void) => {
            if (!!this.call) {
                reject(new Error('Another call is in progress, you should finish it first'));
                return;
            }
            if (!this.currentUser) {
                reject(new Error('You should authenticate first'));
                return;
            }
            // const sdpOffer = await this.webrtcController.initConnection(audio, video);
            this.transport
                .call(deviceId, this.receiveAudio, this.receiveVideo) // sdpOffer,
                .then((call: P2PCall) => {
                    this.call = new P2PCall(call.id, call.user, call.hardware, P2PCallStatus.Pending);
                    resolve(this.call);
                })
                .catch((error: Error) => {
                    reject(error);
                });
        });
    }

    /**
     * Accept the incoming call
     *
     * @param {string}  callId  Id of user to call to
     * @param {boolean} audio     Should the audio be enabled by default
     * @param {boolean} video     Should the video be enabled by default
     * @returns {Promise<P2PCall>}
     */
    /*
    public async acceptCall(callId: string, audio: boolean, video: boolean): Promise<P2PCall> {
        return new Promise(async (resolve: (call: P2PCall) => void, reject: (error: Error) => void) => {
            if (!!this.call) {
                reject(new Error('Another call is in progress, you should finish it first'));
                return;
            }
            if (!this.currentUser) {
                reject(new Error('You should authenticate first'));
                return;
            }
            const incomingCall = this.incomingCalls.get(callId);
            if (!incomingCall) {
                reject(new Error('Call was finished before accepting'));
                return;
            }
            const sdpAnswer = await this.webrtcController.initConnectionAnswering(incomingCall.sdpOffer, audio, video);
            this.transport
                .accept(callId, sdpAnswer, audio, video)
                .then((call: P2PCall) => {
                    this.call = new P2PCall(callId, call.caller, call.callee, P2PCallStatus.Starting);
                    this.incomingCalls.delete(callId);
                    resolve(this.call);
                })
                .catch((error: Error) => {
                    reject(error);
                });
        });
    }
    */

    /**
     * Reject the incoming call
     *
     * @param {string}  callId           Id of user to call to
     * @param {string?} rejectionReason  Optional reason, will be delivered to caller
     * @returns {Promise<void>}
     */
    /*
    public async rejectCall(callId: string, rejectionReason: string): Promise<void> {
        return new Promise(async (resolve: () => void, reject: (error: Error) => void) => {
            if (!this.currentUser) {
                reject(new Error('You should authenticate first'));
                return;
            }
            this.incomingCalls.delete(callId);
            this.transport
                .reject(callId, rejectionReason)
                .then(() => {
                    this.call = undefined;
                    this.webrtcController.closeConnection();
                    resolve();
                })
                .catch((error: Error) => {
                    this.call = undefined;
                    this.webrtcController.closeConnection();
                    reject(error);
                });
        });
    }
    */

    /**
     * Stop pairing process
     *
     * @returns {Promise<void>}
     */
    public toggleOutgoingAudio(enabled: boolean): void {
        if (!this.call) {
            console.warn('You are not in the call');
        }
        return this.webrtcController.toggleOutgoingAudio(enabled);
    }

    /**
     * Stop pairing process
     *
     * @returns {Promise<void>}
     */
    public toggleIncomingMedia(audio: boolean, video: boolean): Promise<void> {
        if (!this.call) {
            return new Promise((_: () => void, reject: (error: Error) => void) => {
                reject(new Error('You are not in the call'));
            });
        }
        return this.transport.toggleIncomingMedia(this.call?.id, audio, video);
    }

    /**
     * Hangup the call
     *
     * @param {string?} hangupReason     Optianl reason, will be delivered to caller
     * @returns {Promise<void>}
     */
    public async hangupCall(hangupReason?: string): Promise<void> {
        return new Promise(async (resolve: () => void, reject: (error: Error) => void) => {
            if (!this.currentUser) {
                reject(new Error('You should authenticate first'));
                return;
            }
            if (!this.call) {
                reject(new Error('There is no call to hangup'));
                return;
            }
            this.incomingCalls.delete(this.call.id);
            this.transport
                .hangup(this.call.id, hangupReason)
                .then(() => {
                    this.call = undefined;
                    this.webrtcController.closeConnection();
                    resolve();
                })
                .catch((error: Error) => {
                    this.call = undefined;
                    this.webrtcController.closeConnection();
                    reject(error);
                });
        });
    }
}
