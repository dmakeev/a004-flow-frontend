export declare function injectWebRTC(WebRTCWrapper: any): void;
export declare enum WebRTCEventType {
    REMOTE_STREAM = "remote_stream",
    LOCAL_STREAM = "local_stream",
    INTERRUPTED = "interrupted",
    ON_ICE_CANDIDATE = "on_ice_candidate"
}
export type WebRTCEvent = (data?: any) => void;
export declare class WebRTCController {
    private readonly eventListeners;
    private iceServers;
    private connection?;
    private localStream?;
    private incomingIceCandidates;
    private outgoingIceCandidates;
    private mediaConstraints;
    get hasConnection(): boolean;
    constructor();
    addEventListener(type: WebRTCEventType, listener: WebRTCEvent): void;
    removeEventListener(type: WebRTCEventType, listener: WebRTCEvent): void;
    setIceServers(iceServers: []): void;
    callStarted(): void;
    initConnection(audio: boolean, video: boolean): Promise<RTCSessionDescription>;
    initConnectionAnswering(sdpOffer: RTCSessionDescription, sendAudio: boolean): Promise<RTCSessionDescription>;
    addAnswer(sdpAnswer: RTCSessionDescription): Promise<void>;
    addCandidate(candidate: RTCIceCandidate): Promise<void>;
    toggleOutgoingAudio(enabled: boolean): void;
    closeConnection(): void;
}
