import 'dart:convert';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import '../core/api_client.dart';
import '../router.dart';
import 'profile_service.dart';

/// Handles a data-only push while the app is fully backgrounded/killed. Must
/// be a top-level (or static) function per firebase_messaging's isolate
/// requirements.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  await PushService._showLocalNotification(message);
}

/// Push notifications (FCM) — chat messages + incoming/missed call alerts,
/// mirroring the web app's service-worker push handling.
///
/// **Requires Firebase project client config files** that this environment
/// cannot generate (see mobile_app/README.md):
///   - android/app/google-services.json
///   - ios/Runner/GoogleService-Info.plist
/// from the *same* Firebase project as `backend/firebase_admin_sdk.json`.
class PushService {
  PushService._();
  static final PushService instance = PushService._();

  static final _localNotifications = FlutterLocalNotificationsPlugin();
  bool _initialized = false;

  Future<void> init() async {
    if (_initialized) return;
    try {
      await Firebase.initializeApp();
    } catch (e) {
      debugPrint('[Push] Firebase.initializeApp failed — is google-services.json present? $e');
      return;
    }

    await _initLocalNotifications();

    final messaging = FirebaseMessaging.instance;
    await messaging.requestPermission(alert: true, badge: true, sound: true, provisional: false);

    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
    FirebaseMessaging.onMessage.listen(_showLocalNotification);
    FirebaseMessaging.onMessageOpenedApp.listen(_onNotificationOpenedApp);

    final token = await messaging.getToken();
    if (token != null) await _registerToken(token);
    messaging.onTokenRefresh.listen(_registerToken);

    _initialized = true;
  }

  Future<void> _registerToken(String token) async {
    try {
      await ProfileService.registerFcmToken(token);
    } catch (e) {
      debugPrint('[Push] Failed to register FCM token: $e');
    }
  }

  static Future<void> _initLocalNotifications() async {
    const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosInit = DarwinInitializationSettings();
    await _localNotifications.initialize(
      const InitializationSettings(android: androidInit, iOS: iosInit),
      onDidReceiveNotificationResponse: _onLocalNotificationTapped,
    );

    const callChannel = AndroidNotificationChannel(
      'call_channel',
      'Calls',
      description: 'Incoming and missed call alerts',
      importance: Importance.max,
      playSound: true,
    );
    const chatChannel = AndroidNotificationChannel(
      'chat_channel',
      'Messages',
      description: 'New chat messages',
      importance: Importance.high,
    );
    final androidPlugin = _localNotifications
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
    await androidPlugin?.createNotificationChannel(callChannel);
    await androidPlugin?.createNotificationChannel(chatChannel);
  }

  static Future<void> _showLocalNotification(RemoteMessage message) async {
    final data = message.data;
    final type = data['type'];
    final isCall = type == 'call';
    final isMissedCall = type == 'missed_call';
    final title = data['title'] ?? message.notification?.title ?? 'Notification';
    final body = data['body'] ?? message.notification?.body ?? '';

    final androidDetails = AndroidNotificationDetails(
      isCall || isMissedCall ? 'call_channel' : 'chat_channel',
      isCall || isMissedCall ? 'Calls' : 'Messages',
      importance: Importance.max,
      priority: Priority.high,
      category: isCall ? AndroidNotificationCategory.call : AndroidNotificationCategory.message,
      fullScreenIntent: isCall,
      actions: isCall
          ? const [
              AndroidNotificationAction('answer', '📞 Answer'),
              AndroidNotificationAction('decline', '❌ Decline'),
            ]
          : null,
    );

    await _localNotifications.show(
      data.hashCode,
      title,
      body,
      NotificationDetails(android: androidDetails, iOS: const DarwinNotificationDetails()),
      payload: jsonEncode(data),
    );
  }

  static void _onLocalNotificationTapped(NotificationResponse response) {
    if (response.payload == null) return;
    final data = jsonDecode(response.payload!) as Map<String, dynamic>;
    if (response.actionId == 'decline') {
      final callerId = data['caller_id'];
      if (callerId != null) {
        () async {
          try {
            await ApiClient.instance.dio.post('/api/ws/chat/call/reject', data: {'caller_id': callerId});
          } catch (_) {
            // Best-effort — the live socket path (if any) already handles this too.
          }
        }();
      }
      return;
    }
    _navigateForData(data);
  }

  void _onNotificationOpenedApp(RemoteMessage message) => _navigateForData(message.data);

  static void _navigateForData(Map<String, dynamic> data) {
    final type = data['type'];
    if (type == 'call' || type == 'missed_call') {
      appRouter.go('/characters');
    } else if (type == 'chat') {
      final senderId = data['sender_id'];
      if (senderId != null) {
        appRouter.push('/human-chat/$senderId');
      }
    } else {
      appRouter.go('/characters');
    }
  }
}
