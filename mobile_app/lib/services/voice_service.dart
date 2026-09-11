import 'dart:io';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import '../core/api_client.dart';

class VoiceService {
  static final _dio = ApiClient.instance.dio;

  /// ElevenLabs TTS playback for an AI companion's reply (2 credits — mirrors
  /// the web app's VoiceButton). Throws a DioException with status 402 if
  /// the user is out of credits.
  static Future<Uint8List> textToSpeech({required String charId, required String text}) async {
    final res = await _dio.post(
      '/api/voice/tts',
      data: {'char_id': charId, 'text': text},
      options: Options(responseType: ResponseType.bytes),
    );
    return Uint8List.fromList(res.data as List<int>);
  }

  /// Uploads a recorded voice note; the backend transcodes it and runs
  /// speech-to-text, returning both the transcript and a permanent URL for
  /// the audio itself.
  static Future<VoiceTranscription> transcribe(File audioFile) async {
    final formData = FormData.fromMap({
      'file': await MultipartFile.fromFile(audioFile.path, filename: 'voice.m4a'),
    });
    final res = await _dio.post('/api/voice/transcribe', data: formData);
    final data = res.data as Map<String, dynamic>;
    return VoiceTranscription(text: data['text'] as String? ?? '', audioUrl: data['audio_url'] as String?);
  }
}

class VoiceTranscription {
  VoiceTranscription({required this.text, this.audioUrl});
  final String text;
  final String? audioUrl;
}
