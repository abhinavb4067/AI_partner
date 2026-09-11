import 'package:flutter/material.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:go_router/go_router.dart';
import '../../core/env.dart';
import '../../services/call_manager.dart';
import '../../widgets/gradient_avatar.dart';

/// The in-call screen — outgoing "ringing" state and the active video/voice
/// call share this screen, exactly like the web app keeps both in HumanChat.
class CallScreen extends StatefulWidget {
  const CallScreen({super.key});

  @override
  State<CallScreen> createState() => _CallScreenState();
}

class _CallScreenState extends State<CallScreen> {
  final _localRenderer = RTCVideoRenderer();
  final _remoteRenderer = RTCVideoRenderer();
  bool _rendererReady = false;

  @override
  void initState() {
    super.initState();
    _setup();
    CallManager.instance.addListener(_onCallStateChanged);
  }

  Future<void> _setup() async {
    await _localRenderer.initialize();
    await _remoteRenderer.initialize();
    setState(() => _rendererReady = true);
    _syncRenderers();
  }

  void _onCallStateChanged() {
    if (!mounted) return;
    _syncRenderers();
    if (CallManager.instance.phase == CallPhase.idle) {
      // Call ended from either side — leave the screen.
      if (context.canPop()) context.pop();
    } else {
      setState(() {});
    }
  }

  void _syncRenderers() {
    if (!_rendererReady) return;
    _localRenderer.srcObject = CallManager.instance.localStream;
    _remoteRenderer.srcObject = CallManager.instance.remoteStream;
  }

  @override
  void dispose() {
    CallManager.instance.removeListener(_onCallStateChanged);
    _localRenderer.dispose();
    _remoteRenderer.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final cm = CallManager.instance;
    final showRemoteVideo = cm.isVideo && cm.remoteStream != null && _rendererReady;
    final showLocalVideo = cm.isVideo && !cm.isCameraOff && cm.localStream != null && _rendererReady;

    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: const Color(0xFF0A0A0F),
        body: SafeArea(
          child: Stack(
            children: [
              // Remote video / avatar background
              Positioned.fill(
                child: showRemoteVideo
                    ? RTCVideoView(_remoteRenderer, objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitCover)
                    : _buildAvatarBackdrop(),
              ),

              // Local self-view (PIP)
              if (showLocalVideo)
                Positioned(
                  top: 24,
                  right: 16,
                  child: Container(
                    width: 100,
                    height: 140,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: Colors.white24),
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: RTCVideoView(_localRenderer, mirror: true, objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitCover),
                  ),
                ),

              // Top status label
              Positioned(
                top: 24,
                left: 16,
                right: showLocalVideo ? 132 : 16,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(cm.peerName, style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 4),
                    Text(_statusLabel(cm.phase), style: const TextStyle(color: Colors.white70, fontSize: 14)),
                  ],
                ),
              ),

              // Bottom controls
              Positioned(
                left: 0,
                right: 0,
                bottom: 30,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    _controlButton(
                      icon: cm.isMuted ? Icons.mic_off : Icons.mic,
                      active: cm.isMuted,
                      onTap: cm.toggleMute,
                    ),
                    const SizedBox(width: 20),
                    _controlButton(
                      icon: Icons.call_end,
                      color: Colors.redAccent,
                      big: true,
                      onTap: cm.endCall,
                    ),
                    const SizedBox(width: 20),
                    if (cm.isVideo)
                      _controlButton(
                        icon: cm.isCameraOff ? Icons.videocam_off : Icons.videocam,
                        active: cm.isCameraOff,
                        onTap: cm.toggleCamera,
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _statusLabel(CallPhase phase) {
    switch (phase) {
      case CallPhase.outgoingRinging:
        return 'Ringing…';
      case CallPhase.incomingRinging:
        return 'Incoming call…';
      case CallPhase.active:
        return CallManager.instance.remoteStream == null ? 'Connecting…' : 'Connected';
      case CallPhase.idle:
        return '';
    }
  }

  Widget _buildAvatarBackdrop() {
    final cm = CallManager.instance;
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFF1A0F24), Color(0xFF0A0A0F)],
        ),
      ),
      child: Center(
        child: GradientAvatar(name: cm.peerName, photoUrl: Env.media(cm.peerAvatarUrl), size: 140, ring: true),
      ),
    );
  }

  Widget _controlButton({required IconData icon, VoidCallback? onTap, bool active = false, bool big = false, Color? color}) {
    final size = big ? 64.0 : 54.0;
    return Material(
      color: color ?? (active ? Colors.white24 : Colors.white12),
      shape: const CircleBorder(),
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: SizedBox(
          width: size,
          height: size,
          child: Icon(icon, color: Colors.white, size: big ? 30 : 24),
        ),
      ),
    );
  }
}
