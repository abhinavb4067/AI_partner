import 'package:go_router/go_router.dart';
import 'core/session.dart';
import 'models/character.dart';
import 'screens/auth/forgot_password_screen.dart';
import 'screens/auth/login_screen.dart';
import 'screens/auth/register_screen.dart';
import 'screens/auth/reset_password_screen.dart';
import 'screens/calls/call_screen.dart';
import 'screens/chat/chat_screen.dart';
import 'screens/chat/story_screen.dart';
import 'screens/home/character_list_screen.dart';
import 'screens/pricing/payment_webview_screen.dart';
import 'screens/pricing/pricing_screen.dart';
import 'screens/profile/profile_screen.dart';
import 'screens/social/discover_screen.dart';
import 'screens/social/human_chat_screen.dart';
import 'screens/social/matches_screen.dart';
import 'screens/splash_screen.dart';
import 'services/social_service.dart';

final appRouter = GoRouter(
  initialLocation: '/',
  refreshListenable: Session.instance,
  redirect: (context, state) {
    final loggedIn = Session.instance.isLoggedIn;
    final loggingIn = ['/login', '/register', '/forgot-password', '/reset-password'].any(
      (p) => state.matchedLocation.startsWith(p),
    );
    if (state.matchedLocation == '/') return null; // let splash decide
    if (!loggedIn && !loggingIn) return '/login';
    if (loggedIn && loggingIn) return '/characters';
    return null;
  },
  routes: [
    GoRoute(path: '/', builder: (context, state) => const SplashScreen()),
    GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
    GoRoute(path: '/register', builder: (context, state) => const RegisterScreen()),
    GoRoute(path: '/forgot-password', builder: (context, state) => const ForgotPasswordScreen()),
    GoRoute(
      path: '/reset-password',
      builder: (context, state) =>
          ResetPasswordScreen(email: state.uri.queryParameters['email'] ?? ''),
    ),
    GoRoute(path: '/characters', builder: (context, state) => const CharacterListScreen()),
    GoRoute(
      path: '/chat/:charId',
      builder: (context, state) => ChatScreen(
        charId: state.pathParameters['charId']!,
        character: state.extra as CharacterSummary?,
      ),
    ),
    GoRoute(
      path: '/story/:charId',
      builder: (context, state) => StoryScreen(charId: state.pathParameters['charId']!),
    ),
    GoRoute(path: '/profile', builder: (context, state) => const ProfileScreen()),
    GoRoute(path: '/pricing', builder: (context, state) => const PricingScreen()),
    GoRoute(
      path: '/pricing/checkout',
      builder: (context, state) => PaymentWebviewScreen(planName: state.uri.queryParameters['plan']),
    ),
    GoRoute(path: '/discover', builder: (context, state) => const DiscoverScreen()),
    GoRoute(path: '/matches', builder: (context, state) => const MatchesScreen()),
    GoRoute(
      path: '/human-chat/:targetId',
      builder: (context, state) => HumanChatScreen(
        targetId: state.pathParameters['targetId']!,
        peer: state.extra as SocialUser?,
      ),
    ),
    GoRoute(path: '/call', builder: (context, state) => const CallScreen()),
  ],
);
