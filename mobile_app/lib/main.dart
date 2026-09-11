import 'package:flutter/material.dart';
import 'core/api_client.dart';
import 'core/session.dart';
import 'core/theme.dart';
import 'core/ws_service.dart';
import 'router.dart';
import 'services/call_manager.dart';
import 'services/push_service.dart';
import 'widgets/incoming_call_overlay.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  // Mirrors the web app's axios 401 interceptor: any request that comes back
  // unauthorized clears the session and bounces to /login.
  ApiClient.instance.onSessionExpired = () async {
    await Session.instance.logout();
    appRouter.go('/login');
  };

  // Keep the realtime socket (human chat + call signaling) connected exactly
  // while the user is logged in.
  bool wasLoggedIn = false;
  Session.instance.addListener(() {
    final loggedIn = Session.instance.isLoggedIn;
    if (loggedIn && !wasLoggedIn) {
      WsService.instance.connect();
    } else if (!loggedIn && wasLoggedIn) {
      WsService.instance.disconnect();
    }
    wasLoggedIn = loggedIn;
  });

  runApp(const AiGirlfriendApp());
}

class AiGirlfriendApp extends StatefulWidget {
  const AiGirlfriendApp({super.key});

  @override
  State<AiGirlfriendApp> createState() => _AiGirlfriendAppState();
}

class _AiGirlfriendAppState extends State<AiGirlfriendApp> {
  @override
  void initState() {
    super.initState();
    CallManager.instance.init();
    // Push notifications are best-effort: this no-ops gracefully if
    // google-services.json / GoogleService-Info.plist haven't been added yet
    // (see mobile_app/README.md) instead of crashing the app.
    PushService.instance.init();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'AI Companions',
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(),
      routerConfig: appRouter,
      builder: (context, child) => IncomingCallOverlay(child: child ?? const SizedBox()),
    );
  }
}
