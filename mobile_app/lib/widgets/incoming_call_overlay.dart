import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../core/env.dart';
import '../core/theme.dart';
import '../services/call_manager.dart';
import 'gradient_avatar.dart';

/// Mounted once at the app root (see main.dart) so an incoming call rings
/// full-screen no matter which screen the user is currently on — the
/// equivalent of the web app's `GlobalCallManager`.
class IncomingCallOverlay extends StatefulWidget {
  const IncomingCallOverlay({super.key, required this.child});
  final Widget child;

  @override
  State<IncomingCallOverlay> createState() => _IncomingCallOverlayState();
}

class _IncomingCallOverlayState extends State<IncomingCallOverlay> {
  @override
  void initState() {
    super.initState();
    CallManager.instance.init();
    CallManager.instance.addListener(_onChange);
  }

  @override
  void dispose() {
    CallManager.instance.removeListener(_onChange);
    super.dispose();
  }

  void _onChange() => setState(() {});

  @override
  Widget build(BuildContext context) {
    final cm = CallManager.instance;
    final showRinging = cm.phase == CallPhase.incomingRinging;

    return Stack(
      children: [
        widget.child,
        if (showRinging)
          Positioned.fill(
            child: Material(
              color: Colors.black.withOpacity(0.92),
              child: SafeArea(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      GradientAvatar(name: cm.peerName, photoUrl: Env.media(cm.peerAvatarUrl), size: 120, ring: true),
                      const SizedBox(height: 28),
                      Text(cm.peerName, style: const TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(cm.isVideo ? Icons.videocam : Icons.call, color: AppColors.teal, size: 18),
                          const SizedBox(width: 8),
                          Text('Incoming ${cm.isVideo ? 'Video' : 'Voice'} Call…',
                              style: const TextStyle(color: AppColors.teal, fontSize: 15, fontWeight: FontWeight.w600)),
                        ],
                      ),
                      const SizedBox(height: 44),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          _actionButton(
                            icon: Icons.call_end,
                            color: Colors.redAccent,
                            label: 'Decline',
                            onTap: () => cm.declineIncoming(),
                          ),
                          const SizedBox(width: 48),
                          _actionButton(
                            icon: Icons.call,
                            color: Colors.green,
                            label: 'Answer',
                            onTap: () {
                              cm.acceptIncoming();
                              context.push('/call');
                            },
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _actionButton({required IconData icon, required Color color, required String label, required VoidCallback onTap}) {
    return Column(
      children: [
        Material(
          color: color,
          shape: const CircleBorder(),
          child: InkWell(
            onTap: onTap,
            customBorder: const CircleBorder(),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Icon(icon, color: Colors.white, size: 30),
            ),
          ),
        ),
        const SizedBox(height: 8),
        Text(label, style: const TextStyle(color: Colors.white70, fontSize: 13)),
      ],
    );
  }
}
