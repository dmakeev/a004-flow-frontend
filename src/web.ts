export const WebRTC = { RTCPeerConnection, MediaStream, RTCSessionDescription, mediaDevices: navigator.mediaDevices };
import { injectWebRTC } from './controllers/webrtc';
injectWebRTC(WebRTC);

export * from './index';
