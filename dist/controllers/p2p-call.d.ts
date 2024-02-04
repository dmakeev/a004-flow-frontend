import { Hardware, P2PCall, type User } from '../models';
export declare enum P2PCallEventType {
    SIGNALING_CONNECTED = "signaling_connected",
    HARDWARE_ONLINE = "hardware_online",
    HARDWARE_OFFLINE = "hardware_offline",
    REMOTE_STREAM = "remote_stream",
    HANGUP = "hangup",
    ERROR = "error"
}
export type P2PCallEvent = (data?: any) => void;
export declare class P2PCallController {
    private call?;
    private readonly transport;
    private readonly eventListeners;
    private readonly userController;
    private readonly webrtcController;
    private incomingCalls;
    private static instance;
    private sendAudio;
    private receiveAudio;
    private receiveVideo;
    /**
     * Returns active call, if any
     *
     * @returns {P2PCall | undefined}
     */
    get currentCall(): P2PCall | undefined;
    /**
     * Returns current user, if any
     *
     * @returns {User | undefined}
     */
    get currentUser(): User | undefined;
    /**
     * Check if connection to the signaling server is active
     *
     * @returns {boolean}
     */
    get signalingConnected(): boolean;
    /**
     * Singletone
     *
     * @returns {P2PCallController}
     */
    static getInstance(): P2PCallController;
    constructor();
    addEventListener(type: P2PCallEventType, listener: P2PCallEvent): void;
    removeEventListener(type: P2PCallEventType, listener: P2PCallEvent): void;
    /**
     * Connect to the signaling server
     *
     * @param {string} url  Url of the signaling server to connect to
     *
     */
    connect(url: string): Promise<void>;
    /**
     * Disconnect from the signaling server
     *
     *
     */
    disconnect(): void;
    /**
     * Login user to the signaling server
     *
     * @param {string} userIdentity User ID
     * @param {string} securityToken Any security token, used by the backend to authorize user
     * @returns {Promise<User>}
     */
    login(userIdentity: string, securityToken: string): Promise<User>;
    /**
     * Logout user
     *
     * @returns {Promise<void>}
     */
    logout(): Promise<void>;
    /**
     * Start pairing process
     *
     * @returns {Promise<void>}
     */
    getHardwareList(): Promise<Hardware[]>;
    /**
     * Start a new call
     *
     * @param {string}  deviceId        Id of user to call to
     * @param {boolean} receiveAudio    Should the incoming audio be enabled by default
     * @param {boolean} receiveVideo    Should the incoming video be enabled by default
     * @param {boolean} sendAudio       Should the outgoing audio be enabled by default
     * @returns {Promise<P2PCall>}
     */
    startCall(deviceId: string, receiveAudio: boolean, receiveVideo: boolean, sendAudio: boolean): Promise<P2PCall>;
    /**
     * Accept the incoming call
     *
     * @param {string}  callId  Id of user to call to
     * @param {boolean} audio     Should the audio be enabled by default
     * @param {boolean} video     Should the video be enabled by default
     * @returns {Promise<P2PCall>}
     */
    /**
     * Reject the incoming call
     *
     * @param {string}  callId           Id of user to call to
     * @param {string?} rejectionReason  Optional reason, will be delivered to caller
     * @returns {Promise<void>}
     */
    /**
     * Stop pairing process
     *
     * @returns {Promise<void>}
     */
    toggleOutgoingAudio(enabled: boolean): void;
    /**
     * Stop pairing process
     *
     * @returns {Promise<void>}
     */
    toggleIncomingMedia(audio: boolean, video: boolean): Promise<void>;
    /**
     * Hangup the call
     *
     * @param {string?} hangupReason     Optianl reason, will be delivered to caller
     * @returns {Promise<void>}
     */
    hangupCall(hangupReason?: string): Promise<void>;
}
