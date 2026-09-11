import 'dart:io';
import 'package:dio/dio.dart';
import '../core/api_client.dart';
import '../models/human_message.dart';

class SocialUser {
  SocialUser({
    required this.id,
    this.username,
    this.name,
    this.avatarUrl,
    this.age,
    this.isOnline = false,
    this.lastSeen,
  });

  final String id;
  final String? username;
  final String? name;
  final String? avatarUrl;
  final int? age;
  final bool isOnline;
  final String? lastSeen;

  factory SocialUser.fromJson(Map<String, dynamic> json) => SocialUser(
        id: json['id'].toString(),
        username: json['username'],
        name: json['name'],
        avatarUrl: json['avatar_url'],
        age: json['age'],
        isOnline: json['is_online'] == true,
        lastSeen: json['last_seen']?.toString(),
      );
}

class HumanMatch {
  HumanMatch({required this.matchId, required this.user, this.matchedAt});
  final dynamic matchId;
  final SocialUser user;
  final String? matchedAt;

  factory HumanMatch.fromJson(Map<String, dynamic> json) => HumanMatch(
        matchId: json['match_id'],
        matchedAt: json['matched_at']?.toString(),
        user: SocialUser(
          id: json['user_id'].toString(),
          username: json['username'],
          name: json['name'],
          avatarUrl: json['avatar_url'],
        ),
      );
}

class SocialService {
  static final _dio = ApiClient.instance.dio;

  static Future<List<SocialUser>> discover() async {
    final res = await _dio.get('/api/social/discover');
    return (res.data as List).map((e) => SocialUser.fromJson(e)).toList();
  }

  static Future<bool> swipe({required String targetId, required bool isLike}) async {
    final res = await _dio.post('/api/social/swipe', data: {'target_id': targetId, 'is_like': isLike});
    return (res.data as Map)['is_match'] == true;
  }

  static Future<List<HumanMatch>> getMatches() async {
    final res = await _dio.get('/api/social/matches');
    return (res.data as List).map((e) => HumanMatch.fromJson(e)).toList();
  }

  static Future<SocialUser?> searchByUsername(String username) async {
    try {
      final res = await _dio.get('/api/social/search/$username');
      return SocialUser.fromJson(res.data as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  static Future<SocialUser?> getUser(String userId) async {
    try {
      final res = await _dio.get('/api/social/user/$userId');
      return SocialUser.fromJson(res.data as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  static Future<List<HumanMessage>> getHistory(String targetId) async {
    final res = await _dio.get('/api/social/history/$targetId');
    return (res.data as List).map((e) => HumanMessage.fromJson(e)).toList();
  }

  static Future<String> uploadChatImage(File file) async {
    final formData = FormData.fromMap({
      'file': await MultipartFile.fromFile(file.path, filename: file.path.split(Platform.pathSeparator).last),
    });
    final res = await _dio.post('/api/social/chat-image', data: formData);
    return (res.data as Map)['url'] as String;
  }

  static Future<void> registerPublicKey(String publicKeyBase64) async {
    await _dio.post('/api/social/public-key', data: {'public_key': publicKeyBase64});
  }

  static Future<String?> getPublicKey(String userId) async {
    final res = await _dio.get('/api/social/public-key/$userId');
    return (res.data as Map)['public_key'] as String?;
  }
}
