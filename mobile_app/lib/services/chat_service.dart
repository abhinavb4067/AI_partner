import '../core/api_client.dart';
import '../core/crypto_service.dart';
import '../core/session.dart';
import '../models/character.dart';
import '../models/chat_message.dart';

class ChatService {
  static final _dio = ApiClient.instance.dio;

  static Future<List<CharacterSummary>> getCharacters() async {
    final res = await _dio.get('/api/chat/characters', queryParameters: {
      'user_id': Session.instance.userId,
    });
    return (res.data as List).map((e) => CharacterSummary.fromJson(e)).toList();
  }

  /// Fetches history and decrypts any Zero-Knowledge-encrypted text in place
  /// (the backend stores AI chat content encrypted to the user's own device
  /// key once a public key has been registered).
  static Future<List<ChatMessageItem>> getHistory(String charId) async {
    final res = await _dio.get('/api/chat/history/${Session.instance.userId}/$charId');
    final items = (res.data as List).map((e) => ChatMessageItem.fromJson(e)).toList();
    return items.map((m) {
      if (m.type == ChatContentType.text && m.isEncrypted && m.text != null) {
        return ChatMessageItem(
          sender: m.sender,
          type: m.type,
          text: CryptoService.instance.decryptChatMessage(m.text!),
          url: m.url,
          time: m.time,
          isEncrypted: true,
        );
      }
      return m;
    }).toList();
  }

  /// Sends a message and returns the AI's reply + optional generated image url.
  /// Throws a DioException with status 402 when the user is out of credits.
  static Future<ChatReplyResult> sendMessage({
    required String charId,
    required String message,
  }) async {
    final res = await _dio.post('/api/chat/', data: {
      'user_id': Session.instance.userId,
      'char_id': charId,
      'message': message,
      'user_public_key': CryptoService.instance.isReady ? CryptoService.instance.myPublicKeyBase64 : null,
    });
    final data = res.data as Map<String, dynamic>;
    // Note: the live response's `reply` is always plaintext — only the copy
    // persisted to the DB is encrypted (see `is_encrypted` on /history items).
    return ChatReplyResult(
      reply: data['reply'] as String? ?? '',
      imageUrl: data['image_url'] as String?,
      time: data['time'] as String?,
    );
  }
}

class ChatReplyResult {
  ChatReplyResult({required this.reply, this.imageUrl, this.time});
  final String reply;
  final String? imageUrl;
  final String? time;
}
