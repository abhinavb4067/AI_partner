import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import '../core/ws_service.dart';
import 'social_service.dart';

enum CallPhase { idle, outgoingRinging, incomingRinging, active }

/// Centralizes WebRTC + call-signaling state for the whole app — the Flutter
/// equivalent of the web app's split GlobalCallManager (ringing UI) +
/// per-chat WebRTC logic in HumanChat.jsx, merged into one place so both the
/// global incoming-call overlay and the in-call screen share one source of
/// truth. Signaling travels over the same socket as human chat messages
/// (`WsService`), exactly like the web app.
class CallManager extends ChangeNotifier {
  CallManager._();
  static final CallManager instance = CallManager._();

  static const _iceServers = [
    {'urls': 'stun:stun.l.google.com:19302'},
    {'urls': 'turn:openrelay.metered.ca:80', 'username': 'openrelayproject', 'credential': 'openrelayproject'},
    {'urls': 'turn:openrelay.metered.ca:443', 'username': 'openrelayproject', 'credential': 'openrelayproject'},
  ];

  CallPhase phase = CallPhase.idle;
  String? peerId;
  String peerName = 'Someone';
  String? peerAvatarUrl;
  bool isVideo = false;
  bool isCaller = false;
  bool isMuted = false;
  bool isCameraOff = false;

  MediaStream? localStream;
  MediaStream? remoteStream;

  RTCPeerConnection? _pc;
  StreamSubscription? _wsSub;
  final List<RTCIceCandidate> _pendingCandidates = [];
  int _sessionId = 0;
  bool _settingUpWebrtc = false;

  bool get isBusy => phase != CallPhase.idle;

  void init() {
    _wsSub ??= WsService.instance.messages.listen(_onWsMessage);
  }

  void _onWsMessage(Map<String, dynamic> data) {
    const signalTypes = {
      'call_request', 'call_accept', 'call_reject', 'call_end', 'call_cancel', 'offer', 'answer', 'ice_candidate'
    };
    final type = data['type'] as String?;
    if (type == null || !signalTypes.contains(type)) return;

    final senderId = data['sender_id']?.toString();

    switch (type) {
      case 'call_request':
        _handleIncomingRequest(senderId, data['video'] == true);
        break;
      case 'call_accept':
        if (senderId == peerId) {
          phase = CallPhase.active;
          notifyListeners();
          _startWebRTC(isCaller: true);
        }
        break;
      case 'call_reject':
      case 'call_end':
      case 'call_cancel':
        if (senderId == peerId || phase == CallPhase.outgoingRinging) {
          _teardown();
        }
        break;
      case 'offer':
        if (senderId == peerId) _handleOffer(data['sdp']);
        break;
      case 'answer':
        if (senderId == peerId) _handleAnswer(data['sdp']);
        break;
      case 'ice_candidate':
        if (senderId == peerId) _handleRemoteCandidate(data['candidate']);
        break;
    }
  }

  Future<void> _handleIncomingRequest(String? callerId, bool video) async {
    if (callerId == null || isBusy) return; // busy-line behavior: ignore a second incoming call
    _sessionId++;
    peerId = callerId;
    peerName = 'Someone';
    peerAvatarUrl = null;
    isVideo = video;
    isCaller = false;
    phase = CallPhase.incomingRinging;
    notifyListeners();

    final user = await SocialService.getUser(callerId);
    if (user != null && peerId == callerId && phase == CallPhase.incomingRinging) {
      peerName = user.name ?? user.username ?? 'Someone';
      peerAvatarUrl = user.avatarUrl;
      notifyListeners();
    }
  }

  Future<void> startOutgoingCall({
    required String targetId,
    required String targetName,
    String? targetAvatarUrl,
    required bool video,
  }) async {
    if (isBusy) return;
    _sessionId++;
    peerId = targetId;
    peerName = targetName;
    peerAvatarUrl = targetAvatarUrl;
    isVideo = video;
    isCaller = true;
    phase = CallPhase.outgoingRinging;
    notifyListeners();
    WsService.instance.send({'type': 'call_request', 'target_id': targetId, 'video': video});
  }

  void acceptIncoming() {
    if (phase != CallPhase.incomingRinging || peerId == null) return;
    phase = CallPhase.active;
    notifyListeners();
    WsService.instance.send({'type': 'call_accept', 'target_id': peerId});
    // Caller sends the offer once they see call_accept — we just wait for it.
  }

  void declineIncoming() {
    if (peerId != null) {
      WsService.instance.send({'type': 'call_reject', 'target_id': peerId});
    }
    _teardown();
  }

  void endCall() {
    if (peerId != null) {
      WsService.instance.send({'type': 'call_end', 'target_id': peerId});
    }
    _teardown();
  }

  Future<void> _startWebRTC({required bool isCaller}) async {
    if (_settingUpWebrtc) return;
    _settingUpWebrtc = true;
    final mySession = _sessionId;
    try {
      final stream = await navigator.mediaDevices.getUserMedia({
        'video': isVideo
            ? {
                'width': {'ideal': 640},
                'height': {'ideal': 480},
                'frameRate': {'ideal': 24},
              }
            : false,
        'audio': {'echoCancellation': true, 'noiseSuppression': true, 'autoGainControl': true},
      });

      if (mySession != _sessionId) {
        for (final t in stream.getTracks()) {
          t.stop();
        }
        return;
      }

      localStream = stream;
      isMuted = false;
      isCameraOff = !isVideo;
      notifyListeners();

      _pc = await createPeerConnection({'iceServers': _iceServers});
      for (final track in stream.getTracks()) {
        await _pc!.addTrack(track, stream);
      }

      _pc!.onTrack = (event) {
        if (event.streams.isNotEmpty) {
          remoteStream = event.streams.first;
          if (event.track.kind == 'video') isVideo = true;
          notifyListeners();
        }
      };

      _pc!.onIceCandidate = (candidate) {
        WsService.instance.send({
          'type': 'ice_candidate',
          'target_id': peerId,
          'candidate': {
            'candidate': candidate.candidate,
            'sdpMid': candidate.sdpMid,
            'sdpMLineIndex': candidate.sdpMLineIndex,
          },
        });
      };

      if (isCaller) {
        final offer = await _pc!.createOffer();
        if (mySession != _sessionId) return;
        await _pc!.setLocalDescription(offer);
        WsService.instance.send({
          'type': 'offer',
          'target_id': peerId,
          'sdp': {'sdp': offer.sdp, 'type': offer.type},
        });
      }
    } catch (e) {
      debugPrint('[CallManager] WebRTC setup failed: $e');
      if (mySession == _sessionId) {
        endCall();
      }
    } finally {
      _settingUpWebrtc = false;
    }
  }

  Future<void> _handleOffer(dynamic sdp) async {
    if (_pc == null) await _startWebRTC(isCaller: false);
    await _pc?.setRemoteDescription(RTCSessionDescription(sdp['sdp'], sdp['type']));
    await _drainQueuedCandidates();
    final answer = await _pc!.createAnswer();
    await _pc!.setLocalDescription(answer);
    WsService.instance.send({
      'type': 'answer',
      'target_id': peerId,
      'sdp': {'sdp': answer.sdp, 'type': answer.type},
    });
  }

  Future<void> _handleAnswer(dynamic sdp) async {
    await _pc?.setRemoteDescription(RTCSessionDescription(sdp['sdp'], sdp['type']));
    await _drainQueuedCandidates();
  }

  Future<void> _handleRemoteCandidate(dynamic candidateJson) async {
    final candidate = RTCIceCandidate(
      candidateJson['candidate'],
      candidateJson['sdpMid'],
      candidateJson['sdpMLineIndex'],
    );
    if (_pc != null && (await _pc!.getRemoteDescription()) != null) {
      await _pc!.addCandidate(candidate);
    } else {
      _pendingCandidates.add(candidate);
    }
  }

  Future<void> _drainQueuedCandidates() async {
    for (final c in _pendingCandidates) {
      await _pc?.addCandidate(c);
    }
    _pendingCandidates.clear();
  }

  void toggleMute() {
    isMuted = !isMuted;
    localStream?.getAudioTracks().forEach((t) => t.enabled = !isMuted);
    notifyListeners();
  }

  void toggleCamera() {
    isCameraOff = !isCameraOff;
    localStream?.getVideoTracks().forEach((t) => t.enabled = !isCameraOff);
    notifyListeners();
  }

  void _teardown() {
    _sessionId++;
    _pc?.close();
    _pc = null;
    localStream?.getTracks().forEach((t) => t.stop());
    localStream = null;
    remoteStream = null;
    _pendingCandidates.clear();
    phase = CallPhase.idle;
    peerId = null;
    isVideo = false;
    isCaller = false;
    isMuted = false;
    isCameraOff = false;
    notifyListeners();
  }
}
