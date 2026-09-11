import 'package:flutter_test/flutter_test.dart';
import 'package:ai_girlfriend_app/models/character.dart';
import 'package:ai_girlfriend_app/models/chat_message.dart';
import 'package:ai_girlfriend_app/models/human_message.dart';
import 'package:ai_girlfriend_app/core/env.dart';

void main() {
  group('CharacterSummary.fromJson', () {
    test('parses a full character payload', () {
      final c = CharacterSummary.fromJson({
        'id': 3,
        'name': 'Maya',
        'slug': 'maya',
        'gender': 'female',
        'about': 'Loves late-night talks',
        'photo_url': '/media/characters/maya.jpg',
        'last_message': 'Hey you 💕',
        'last_message_sender': 'assistant',
        'last_message_time': '2026-09-11T10:00:00Z',
      });
      expect(c.id, 3);
      expect(c.idStr, '3');
      expect(c.name, 'Maya');
      expect(c.lastMessage, 'Hey you 💕');
    });

    test('handles missing optional fields without throwing', () {
      final c = CharacterSummary.fromJson({'id': 1, 'name': 'Zara'});
      expect(c.name, 'Zara');
      expect(c.about, isNull);
      expect(c.lastMessage, isNull);
    });
  });

  group('ChatMessageItem.fromJson', () {
    test('parses a text message from an AI', () {
      final m = ChatMessageItem.fromJson({'sender': 'ai', 'type': 'text', 'text': 'hi', 'time': 't'});
      expect(m.sender, ChatSender.ai);
      expect(m.type, ChatContentType.text);
      expect(m.text, 'hi');
      expect(m.isEncrypted, isFalse);
    });

    test('parses an encrypted user message', () {
      final m = ChatMessageItem.fromJson({'sender': 'user', 'type': 'text', 'text': 'xyz==', 'is_encrypted': true});
      expect(m.sender, ChatSender.user);
      expect(m.isEncrypted, isTrue);
    });

    test('parses an image message', () {
      final m = ChatMessageItem.fromJson({'sender': 'ai', 'type': 'image', 'url': '/media/x.jpg'});
      expect(m.type, ChatContentType.image);
      expect(m.url, '/media/x.jpg');
    });

    test('unknown type falls back to text', () {
      final m = ChatMessageItem.fromJson({'sender': 'ai', 'type': 'something_new'});
      expect(m.type, ChatContentType.text);
    });
  });

  group('HumanMessage.fromJson', () {
    test('parses fields and defaults', () {
      final m = HumanMessage.fromJson({
        'id': 42,
        'sender_id': 'u1',
        'receiver_id': 'u2',
        'content': 'hello',
        'message_type': 'text',
      });
      expect(m.id, 42);
      expect(m.isViewed, isFalse);
      expect(m.isDelivered, isTrue); // defaults true unless explicitly false
    });

    test('is_delivered: false is respected', () {
      final m = HumanMessage.fromJson({
        'id': 1,
        'sender_id': 'u1',
        'receiver_id': 'u2',
        'content': 'hi',
        'message_type': 'text',
        'is_delivered': false,
      });
      expect(m.isDelivered, isFalse);
    });
  });

  group('Env.media', () {
    test('prefixes a relative path with the API base URL', () {
      expect(Env.media('/media/characters/maya.jpg'),
          '${Env.apiBaseUrl}/media/characters/maya.jpg');
    });

    test('leaves absolute http(s) URLs untouched', () {
      expect(Env.media('https://cdn.example.com/x.jpg'), 'https://cdn.example.com/x.jpg');
      expect(Env.media('http://cdn.example.com/x.jpg'), 'http://cdn.example.com/x.jpg');
    });

    test('leaves data: URIs untouched', () {
      const dataUri = 'data:image/png;base64,abc123';
      expect(Env.media(dataUri), dataUri);
    });

    test('returns empty string for null/empty input', () {
      expect(Env.media(null), '');
      expect(Env.media(''), '');
    });
  });
}
