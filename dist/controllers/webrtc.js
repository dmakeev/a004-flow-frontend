let WebRTC;
export function injectWebRTC(WebRTCWrapper) {
    WebRTC = WebRTCWrapper;
}
export var WebRTCEventType;
(function (WebRTCEventType) {
    WebRTCEventType["REMOTE_STREAM"] = "remote_stream";
    WebRTCEventType["LOCAL_STREAM"] = "local_stream";
    WebRTCEventType["INTERRUPTED"] = "interrupted";
    WebRTCEventType["ON_ICE_CANDIDATE"] = "on_ice_candidate";
})(WebRTCEventType || (WebRTCEventType = {}));
export class WebRTCController {
    eventListeners = new Map();
    iceServers = [];
    connection;
    localStream;
    incomingIceCandidates = [];
    outgoingIceCandidates = [];
    mediaConstraints = {
        audio: true,
        video: false,
    };
    get hasConnection() {
        return !!this.connection;
    }
    constructor() {
        for (const v of Object.values(WebRTCEventType)) {
            this.eventListeners.set(v, new Set());
        }
    }
    addEventListener(type, listener) {
        this.eventListeners.get(type)?.add(listener);
    }
    removeEventListener(type, listener) {
        this.eventListeners.get(type)?.delete(listener);
    }
    setIceServers(iceServers) {
        this.iceServers = iceServers;
    }
    callStarted() {
        this.outgoingIceCandidates.forEach((candidate) => {
            this.eventListeners.get(WebRTCEventType.ON_ICE_CANDIDATE)?.forEach((listener) => {
                listener({ candidate });
            });
        });
        this.outgoingIceCandidates.length = 0;
    }
    async initConnection(audio, video) {
        this.outgoingIceCandidates.length = 0;
        this.incomingIceCandidates.length = 0;
        return new Promise((resolve, reject) => {
            if (!!this.localStream) {
                this.localStream.getTracks().forEach((track) => track.stop());
            }
            WebRTC.mediaDevices
                .getUserMedia({
                audio: audio ? this.mediaConstraints.audio : false,
                video: video ? this.mediaConstraints.video : false,
            })
                .then((stream) => {
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
                        this.outgoingIceCandidates.push(event.candidate);
                    }
                });
                this.connection
                    .createOffer({
                //offerToReceiveAudio: true,
                //offerToReceiveVideo: true,
                // VoiceActivityDetection: true,
                })
                    .then((sdpOffer) => {
                    this.connection
                        ?.setLocalDescription(sdpOffer)
                        .then(() => {
                        resolve(this.connection?.localDescription);
                    })
                        .catch((error) => {
                        reject(error);
                    });
                })
                    .catch((error) => {
                    reject(error);
                });
            })
                .catch((error) => reject(error));
        });
    }
    async initConnectionAnswering(sdpOffer, sendAudio
    // sendVideo: boolean
    ) {
        this.outgoingIceCandidates.length = 0;
        return new Promise((resolve, reject) => {
            if (!!this.localStream) {
                this.localStream.getTracks().forEach((track) => track.stop());
            }
            WebRTC.mediaDevices
                .getUserMedia({
                //audio: audio ? this.mediaConstraints.audio : false,
                //video: video ? this.mediaConstraints.video : false,
                audio: this.mediaConstraints.audio,
                video: false,
            })
                .then((stream) => {
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
                    }
                    catch (error) { }
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
                    })
                        .then((sdpAnswer) => {
                        this.connection
                            ?.setLocalDescription(sdpAnswer)
                            .then(() => {
                            this.incomingIceCandidates.forEach((candidate) => this.connection?.addIceCandidate(candidate));
                            this.incomingIceCandidates.length = 0;
                            resolve(this.connection?.localDescription);
                        })
                            .catch((error) => reject(error));
                    })
                        .catch((error) => reject(error));
                })
                    .catch((error) => {
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
                this.connection.addEventListener('icecandidateerror', (error) => {
                    console.error(error);
                    // console.log('Negotiation needed');
                });
            })
                .catch((error) => reject(error));
        });
    }
    async addAnswer(sdpAnswer) {
        if (!this.connection) {
            console.warn('Trying to set sdpAnswer for non-existing connection');
            return;
        }
        console.log(sdpAnswer);
        return this.connection.setRemoteDescription(sdpAnswer);
    }
    async addCandidate(candidate) {
        if (!this.connection || this.connection.signalingState === 'stable') {
            this.incomingIceCandidates.push(candidate);
            // console.warn('Trying to set ICE Candidate for non-existing connection');
            return;
        }
        if (!!candidate) {
            return this.connection.addIceCandidate(candidate);
        }
    }
    toggleOutgoingAudio(enabled) {
        this.localStream?.getAudioTracks().forEach((track) => (track.enabled = enabled));
    }
    closeConnection() {
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
//# sourceMappingURL=webrtc.js.map