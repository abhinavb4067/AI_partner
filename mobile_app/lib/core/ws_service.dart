import 'dart:async';
import 'dart:convert';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'env.dart';
import 'session.dart';

/// The single persistent WebSocket connection used for human-to-human chat
/// (text/image/read-receipts) *and* WebRTC call signaling — mirrors the web
/// app's `GlobalCallManager` + `HumanChat` socket usage, which both share one
/// connection to `/api/ws/chat/{token}`.
class WsService {
  WsService._();
  static final WsService instance = WsService._();

  WebSocketChannel? _channel;
  StreamSubscription? _sub;
  Timer? _reconnectTimer;
  bool _wantConnected = false;

  final _messageController = StreamController<Map<String, dynamic>>.broadcast();

  /// Every decoded JSON frame from the server, regardless of `type`.
  Stream<Map<String, dynamic>> get messages => _messageController.stream;

  bool get isConnected => _channel != null;

  void connect() {
    _wantConnected = true;
    _open();
  }

  void _open() {
    final token = Session.instance.token;
    if (token == null || token.isEmpty) return;

    final wsBase = Env.apiBaseUrl.replaceFirst('https://', 'wss://').replaceFirst('http://', 'ws://');
    final uri = Uri.parse('$wsBase/api/ws/chat/$token');

    try {
      _channel = WebSocketChannel.connect(uri);
      _sub = _channel!.stream.listen(
        (event) {
          try {
            final data = jsonDecode(event as String) as Map<String, dynamic>;
            _messageController.add(data);
          } catch (_) {
            // ignore malformed frames
          }
        },
        onDone: _scheduleReconnect,
        onError: (_) => _scheduleReconnect(),
        cancelOnError: true,
      );
    } catch (_) {
      _scheduleReconnect();
    }
  }

  void _scheduleReconnect() {
    _channel = null;
    _sub?.cancel();
    if (!_wantConnected) return;
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(const Duration(seconds: 4), () {
      if (_wantConnected) _open();
    });
  }

  void send(Map<String, dynamic> payload) {
    _channel?.sink.add(jsonEncode(payload));
  }

  void disconnect() {
    _wantConnected = false;
    _reconnectTimer?.cancel();
    _sub?.cancel();
    _channel?.sink.close();
    _channel = null;
  }
}
