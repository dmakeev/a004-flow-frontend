export declare const WebRTC: {
    RTCPeerConnection: {
        new (configuration?: RTCConfiguration | undefined): RTCPeerConnection;
        prototype: RTCPeerConnection;
        generateCertificate(keygenAlgorithm: AlgorithmIdentifier): Promise<RTCCertificate>;
    };
    MediaStream: {
        new (): MediaStream;
        new (stream: MediaStream): MediaStream;
        new (tracks: MediaStreamTrack[]): MediaStream;
        prototype: MediaStream;
    };
    RTCSessionDescription: {
        new (descriptionInitDict: RTCSessionDescriptionInit): RTCSessionDescription;
        prototype: RTCSessionDescription;
    };
    mediaDevices: MediaDevices;
};
export * from './index';
