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
  ///
  /// The backend used to take the user id as a path segment here
  /// (/history/{user_id}/{char_id}); as of 2026-09-13 it derives the caller
  /// solely from the Bearer token (see backend/app/api/routes/chat.py) to
  /// close an IDOR — the old shape would 404 now.
  static Future<List<ChatMessageItem>> getHistory(String charId) async {
    final res = await _dio.get('/api/chat/history/$charId');
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

  /// "Our Story" — a relationship timeline built from data the backend was
  /// already storing (chat timestamps, remembered facts). See
  /// backend/app/api/routes/chat.py:get_relationship_story for the full
  /// product rationale; this mirrors the web app's /story/:charId page.
  static Future<RelationshipStory> getStory(String charId) async {
    final res = await _dio.get('/api/chat/story/$charId');
    return RelationshipStory.fromJson(res.data as Map<String, dynamic>);
  }
}

class RelationshipStory {
  RelationshipStory({
    required this.started,
    required this.characterName,
    this.characterPhoto,
    this.daysTogether = 0,
    this.activeDays = 0,
    this.totalMessages = 0,
    this.photosShared = 0,
    this.stage,
    this.milestones = const [],
    this.memories = const [],
  });

  final bool started;
  final String characterName;
  final String? characterPhoto;
  final int daysTogether;
  final int activeDays;
  final int totalMessages;
  final int photosShared;
  final RelationshipStage? stage;
  final List<StoryMilestone> milestones;
  final List<StoryMemory> memories;

  factory RelationshipStory.fromJson(Map<String, dynamic> j) {
    if (j['started'] != true) {
      return RelationshipStory(started: false, characterName: j['character_name'] as String? ?? '');
    }
    return RelationshipStory(
      started: true,
      characterName: j['character_name'] as String? ?? '',
      characterPhoto: j['character_photo'] as String?,
      daysTogether: j['days_together'] as int? ?? 0,
      activeDays: j['active_days'] as int? ?? 0,
      totalMessages: j['total_messages'] as int? ?? 0,
      photosShared: j['photos_shared'] as int? ?? 0,
      stage: j['stage'] != null ? RelationshipStage.fromJson(j['stage'] as Map<String, dynamic>) : null,
      milestones: (j['milestones'] as List? ?? [])
          .map((e) => StoryMilestone.fromJson(e as Map<String, dynamic>))
          .toList(),
      memories: (j['memories'] as List? ?? [])
          .map((e) => StoryMemory.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

class RelationshipStage {
  RelationshipStage({
    required this.label,
    required this.icon,
    this.nextLabel,
    this.daysToNext = 0,
    this.progress = 0,
  });

  final String label;
  final String icon;
  final String? nextLabel;
  final int daysToNext;
  final double progress;

  factory RelationshipStage.fromJson(Map<String, dynamic> j) => RelationshipStage(
        label: j['label'] as String? ?? '',
        icon: j['icon'] as String? ?? '',
        nextLabel: j['next_label'] as String?,
        daysToNext: j['days_to_next'] as int? ?? 0,
        progress: (j['progress'] as num?)?.toDouble() ?? 0,
      );
}

class StoryMilestone {
  StoryMilestone({required this.date, required this.icon, required this.title});
  final DateTime date;
  final String icon;
  final String title;

  factory StoryMilestone.fromJson(Map<String, dynamic> j) => StoryMilestone(
        date: DateTime.tryParse(j['date'] as String? ?? '') ?? DateTime.now(),
        icon: j['icon'] as String? ?? '',
        title: j['title'] as String? ?? '',
      );
}

class StoryMemory {
  StoryMemory({required this.key, required this.value});
  final String key;
  final String value;

  factory StoryMemory.fromJson(Map<String, dynamic> j) => StoryMemory(
        key: j['key'] as String? ?? '',
        value: j['value'] as String? ?? '',
      );
}

class ChatReplyResult {
  ChatReplyResult({required this.reply, this.imageUrl, this.time});
  final String reply;
  final String? imageUrl;
  final String? time;
}
