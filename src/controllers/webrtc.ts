let WebRTC: any;

export function injectWebRTC(WebRTCWrapper: any) {
    WebRTC = WebRTCWrapper;
}

export enum WebRTCEventType {
    REMOTE_STREAM = 'remote_stream',
    LOCAL_STREAM = 'local_stream',
    INTERRUPTED = 'interrupted',
    ON_ICE_CANDIDATE = 'on_ice_candidate',
}

export type WebRTCEvent = (data?: any) => void;

export class WebRTCController {
    private readonly eventListeners: Map<WebRTCEventType, Set<WebRTCEvent>> = new Map<WebRTCEventType, Set<WebRTCEvent>>();
    private iceServers: [] = [];
    private connection?: RTCPeerConnection;
    private localStream?: MediaStream;
    private incomingIceCandidates: RTCIceCandidate[] = [];
    private outgoingIceCandidates: RTCIceCandidate[] = [];
    private mediaConstraints = {
        audio: true,
        video: false,
    };

    public get hasConnection(): boolean {
        return !!this.connection;
    }

    constructor() {
        for (const v of Object.values(WebRTCEventType)) {
            this.eventListeners.set(v, new Set());
        }
    }

    public addEventListener(type: WebRTCEventType, listener: WebRTCEvent): void {
        this.eventListeners.get(type)?.add(listener);
    }

    public removeEventListener(type: WebRTCEventType, listener: WebRTCEvent): void {
        this.eventListeners.get(type)?.delete(listener);
    }

    public setIceServers(iceServers: []): void {
        this.iceServers = iceServers;
    }

    public callStarted(): void {
        this.outgoingIceCandidates.forEach((candidate: RTCIceCandidate) => {
            this.eventListeners.get(WebRTCEventType.ON_ICE_CANDIDATE)?.forEach((listener) => {
                listener({ candidate });
            });
        });
        this.outgoingIceCandidates.length = 0;
    }

    public async initConnection(audio: boolean, video: boolean): Promise<RTCSessionDescription> {
        this.outgoingIceCandidates.length = 0;
        this.incomingIceCandidates.length = 0;
        return new Promise((resolve: (sdpAnswer: RTCSessionDescription) => void, reject: (error: Error) => void) => {
            if (!!this.localStream) {
                this.localStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
            }
            WebRTC.mediaDevices
                .getUserMedia({
                    audio: audio ? this.mediaConstraints.audio : false,
                    video: video ? this.mediaConstraints.video : false,
                })
                .then((stream: MediaStream) => {
                    this.localStream = stream;
                    setTimeout(() => {
                        this.eventListeners.get(WebRTCEventType.LOCAL_STREAM)?.forEach((listener) => {
                            // this.videoStream = new WebRTC.MediaStream(this.localStream?.getVideoTracks());
                            // listener({ stream: this.videoStream });
                            listener({ stream });
                        });
                    }, 0);

                    if (!!this.connection) {
                        this.connection.close();
                    }
                    this.connection = new WebRTC.RTCPeerConnection({ iceServers: this.iceServers, bunlePolicy: 'max-bundle' });
                    if (!this.connection) {
                        reject(new Error('Failed to create RTCPeerConnection'));
                        return;
                    }
                    for (const track of this.localStream.getTracks()) {
                        console.log(track);
                        this.connection.addTrack(track, this.localStream);
                    }
                    this.connection.addEventListener('track', (event) => {
                        this.eventListeners
                            .get(WebRTCEventType.REMOTE_STREAM)
                            ?.forEach((listener) => listener({ stream: event.streams[0] }));
                    });

                    this.connection.addEventListener('iceconnectionstatechange', () => {
                        // console.log('ICE connection state', this.connection?.iceConnectionState);
                    });

                    this.connection.addEventListener('icegatheringstatechange', () => {
                        // console.log('ICE gathering state', this.connection?.iceGatheringState);
                    });

                    this.connection.addEventListener('negotiationneeded', () => {
                        // console.log('Negotiation needed');
                    });

                    this.connection?.addEventListener('icecandidate', (event) => {
                        if (event.candidate) {
                            this.outgoingIceCandidates.push(event.candidate!);
                        }
                    });
                    this.connection
                        .createOffer({
                            //offerToReceiveAudio: true,
                            //offerToReceiveVideo: true,
                            // VoiceActivityDetection: true,
                        })
                        .then((sdpOffer: RTCSessionDescriptionInit) => {
                            this.connection
                                ?.setLocalDescription(sdpOffer)
                                .then(() => {
                                    resolve(this.connection?.localDescription!);
                                })
                                .catch((error: Error) => {
                                    reject(error);
                                });
                        })
                        .catch((error: Error) => {
                            reject(error);
                        });
                })
                .catch((error: Error) => reject(error));
        });
    }

    public async initConnectionAnswering(
        sdpOffer: RTCSessionDescription,
        sendAudio: boolean
        // sendVideo: boolean
    ): Promise<RTCSessionDescription> {
        this.outgoingIceCandidates.length = 0;
        return new Promise((resolve: (sdpAnswer: RTCSessionDescription) => void, reject: (error: Error) => void) => {
            if (!!this.localStream) {
                this.localStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
            }

            WebRTC.mediaDevices
                .getUserMedia({
                    //audio: audio ? this.mediaConstraints.audio : false,
                    //video: video ? this.mediaConstraints.video : false,
                    audio: this.mediaConstraints.audio,
                    video: false,
                })
                .then((stream: MediaStream) => {
                    this.localStream = stream;
                    stream.getAudioTracks().forEach((track) => (track.enabled = sendAudio));
                    setTimeout(() => {
                        this.eventListeners.get(WebRTCEventType.LOCAL_STREAM)?.forEach((listener) => {
                            // this.videoStream = new WebRTC.MediaStream(this.localStream?.getVideoTracks());
                            // listener({ stream: this.videoStream });
                            listener({ stream });
                        });
                    }, 0);
                    if (!!this.connection) {
                        try {
                            this.connection.close();
                        } catch (error: unknown) {}
                    }
                    this.connection = new WebRTC.RTCPeerConnection({ iceServers: this.iceServers, bunlePolicy: 'max-bundle' });
                    if (!this.connection) {
                        reject(new Error('Unable to create RTCPeerConnection'));
                        return;
                    }
                    for (const track of this.localStream.getTracks()) {
                        this.connection.addTrack(track, this.localStream);
                    }

                    this.connection?.addEventListener('icecandidate', (event) => {
                        if (!event.candidate) {
                            return;
                        }
                        this.eventListeners.get(WebRTCEventType.ON_ICE_CANDIDATE)?.forEach((listener) => {
                            listener({ candidate: event.candidate });
                        });
                    });

                    this.connection
                        .setRemoteDescription(sdpOffer)
                        .then(() => {
                            this.connection
                                ?.createAnswer({
                                    //mandatory: {
                                    //offerToReceiveAudio: true,
                                    //offerToReceiveVideo: true,
                                    //VoiceActivityDetection: true,
                                    // },
                                } as RTCAnswerOptions)
                                .then((sdpAnswer: RTCSessionDescriptionInit) => {
                                    this.connection
                                        ?.setLocalDescription(sdpAnswer)
                                        .then(() => {
                                            this.incomingIceCandidates.forEach((candidate) => this.connection?.addIceCandidate(candidate));
                                            this.incomingIceCandidates.length = 0;
                                            resolve(this.connection?.localDescription!);
                                        })
                                        .catch((error: Error) => reject(error));
                                })
                                .catch((error: Error) => reject(error));
                        })
                        .catch((error: Error) => {
                            console.warn(error);
                            reject(error);
                        });

                    this.connection.addEventListener('track', (event) => {
                        console.log(event);
                        this.eventListeners
                            .get(WebRTCEventType.REMOTE_STREAM)
                            ?.forEach((listener) => listener({ stream: event.streams[0] }));
                    });

                    this.connection.addEventListener('iceconnectionstatechange', () => {
                        // console.log('ICE connection state', this.connection?.iceConnectionState);
                    });

                    this.connection.addEventListener('icegatheringstatechange', () => {
                        // console.log('ICE gathering state', this.connection?.iceGatheringState);
                    });

                    this.connection.addEventListener('negotiationneeded', () => {
                        // console.log('Negotiation needed');
                    });

                    this.connection.addEventListener('icecandidateerror', (_) => {
                        // console.log('Negotiation needed');
                    });
                })
                .catch((error: Error) => reject(error));
        });
    }

    public async addAnswer(sdpAnswer: RTCSessionDescription): Promise<void> {
        if (!this.connection) {
            console.warn('Trying to set sdpAnswer for non-existing connection');
            return;
        }
        console.log(sdpAnswer);
        return this.connection.setRemoteDescription(sdpAnswer);
    }

    public async addCandidate(candidate: RTCIceCandidate): Promise<void> {
        if (!this.connection || this.connection.signalingState === 'stable') {
            this.incomingIceCandidates.push(candidate);
            // console.warn('Trying to set ICE Candidate for non-existing connection');
            return;
        }
        if (!!candidate) {
            return this.connection.addIceCandidate(candidate);
        }
    }

    public toggleOutgoingAudio(enabled: boolean): void {
        this.localStream?.getAudioTracks().forEach((track) => (track.enabled = enabled));
    }

    public closeConnection(): void {
        if (!!this.localStream) {
            for (const track of this.localStream.getTracks()) {
                track.stop();
            }
            this.localStream = undefined;
        }
        // this.videoStream = undefined;
        if (!!this.connection) {
            this.connection.close();
            this.connection = undefined;
        }
    }
}
