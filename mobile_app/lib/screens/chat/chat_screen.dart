import 'dart:io';

import 'package:audioplayers/audioplayers.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';
import '../../core/api_client.dart';
import '../../core/env.dart';
import '../../core/theme.dart';
import '../../models/character.dart';
import '../../models/chat_message.dart';
import '../../services/chat_service.dart';
import '../../services/voice_service.dart';
import '../../widgets/gradient_avatar.dart';

class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key, required this.charId, this.character});

  final String charId;
  final CharacterSummary? character;

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _messages = <ChatMessageItem>[];
  final _controller = TextEditingController();
  final _scroll = ScrollController();
  final _recorder = AudioRecorder();
  bool _loadingHistory = true;
  bool _sending = false;
  bool _recording = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  @override
  void dispose() {
    _recorder.dispose();
    super.dispose();
  }

  Future<void> _loadHistory() async {
    setState(() => _loadingHistory = true);
    try {
      final history = await ChatService.getHistory(widget.charId);
      setState(() {
        _messages
          ..clear()
          ..addAll(history);
      });
      _scrollToBottom();
    } catch (e) {
      setState(() => _error = apiErrorMessage(e, fallback: 'Failed to load chat history.'));
    } finally {
      if (mounted) setState(() => _loadingHistory = false);
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.animateTo(
          _scroll.position.maxScrollExtent,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _send({String? overrideText, bool hideUserBubble = false}) async {
    final text = (overrideText ?? _controller.text).trim();
    if (text.isEmpty || _sending) return;
    if (overrideText == null) _controller.clear();

    ChatMessageItem? userMsg;
    if (!hideUserBubble) {
      userMsg = ChatMessageItem(sender: ChatSender.user, type: ChatContentType.text, text: text);
      setState(() => _messages.add(userMsg!));
    }
    setState(() => _sending = true);
    _scrollToBottom();

    try {
      final result = await ChatService.sendMessage(charId: widget.charId, message: text);
      setState(() {
        if (result.reply.isNotEmpty) {
          _messages.add(ChatMessageItem(
            sender: ChatSender.ai,
            type: ChatContentType.text,
            text: result.reply,
            time: result.time,
          ));
        }
        if (result.imageUrl != null && result.imageUrl!.isNotEmpty) {
          _messages.add(ChatMessageItem(
            sender: ChatSender.ai,
            type: ChatContentType.image,
            url: result.imageUrl,
            time: result.time,
          ));
        }
      });
    } catch (e) {
      final isOutOfCredits = apiErrorMessage(e).contains('out_of_credits') ||
          (e is DioException && e.response?.statusCode == 402);
      if (userMsg != null) setState(() => userMsg!.failed = true);
      if (mounted) {
        if (isOutOfCredits) {
          _showOutOfCredits();
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(apiErrorMessage(e, fallback: 'Message failed to send.'))),
          );
        }
      }
    } finally {
      if (mounted) setState(() => _sending = false);
      _scrollToBottom();
    }
  }

  Future<void> _startRecording() async {
    if (_recording) return;
    if (!await _recorder.hasPermission()) return;
    final dir = await getTemporaryDirectory();
    final path = '${dir.path}/voice_${DateTime.now().millisecondsSinceEpoch}.m4a';
    await _recorder.start(const RecordConfig(encoder: AudioEncoder.aacLc), path: path);
    setState(() => _recording = true);
  }

  Future<void> _stopRecordingAndSend() async {
    if (!_recording) return;
    final path = await _recorder.stop();
    setState(() => _recording = false);
    if (path == null) return;

    setState(() => _messages.add(ChatMessageItem(sender: ChatSender.user, type: ChatContentType.audio, url: path)));
    _scrollToBottom();

    setState(() => _sending = true);
    try {
      final result = await VoiceService.transcribe(File(path));
      if (result.audioUrl != null) {
        setState(() {
          final idx = _messages.lastIndexWhere((m) => m.type == ChatContentType.audio && m.url == path);
          if (idx != -1) _messages[idx] = ChatMessageItem(sender: ChatSender.user, type: ChatContentType.audio, url: result.audioUrl);
        });
      }
      if (result.text.isNotEmpty) {
        final withTag = result.audioUrl != null ? '[AUDIO:${result.audioUrl}] ${result.text}' : result.text;
        setState(() => _sending = false);
        await _send(overrideText: withTag, hideUserBubble: true);
        return;
      }
    } catch (_) {
      setState(() => _messages.add(ChatMessageItem(sender: ChatSender.ai, type: ChatContentType.text, text: "Sorry, I couldn't understand the audio.")));
    }
    if (mounted) setState(() => _sending = false);
  }

  void _cancelRecording() async {
    if (!_recording) return;
    await _recorder.stop();
    setState(() => _recording = false);
  }

  void _showOutOfCredits() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.bgPanel,
        title: const Text('💎 Out of Credits'),
        content: const Text("You've used all your credits. Upgrade your plan to keep chatting."),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Maybe later')),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              context.push('/pricing');
            },
            child: const Text('Upgrade Plan'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final name = widget.character?.name ?? 'Chat';
    return Scaffold(
      backgroundColor: const Color(0xFF0B141A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF202C33),
        titleSpacing: 0,
        title: Row(
          children: [
            GradientAvatar(name: name, photoUrl: Env.media(widget.character?.photoUrl), size: 38),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(name, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600), overflow: TextOverflow.ellipsis),
                  const Text('online', style: TextStyle(fontSize: 12, color: AppColors.teal)),
                ],
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Our Story',
            icon: const Text('📖', style: TextStyle(fontSize: 20)),
            onPressed: () => context.push('/story/${widget.charId}'),
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: _loadingHistory
                ? const Center(child: CircularProgressIndicator(color: AppColors.pink))
                : _error != null
                    ? Center(child: Text(_error!, style: const TextStyle(color: AppColors.textSecondary)))
                    : ListView.builder(
                        controller: _scroll,
                        padding: const EdgeInsets.all(12),
                        itemCount: _messages.length + (_sending ? 1 : 0),
                        itemBuilder: (context, i) {
                          if (i == _messages.length) return const _TypingBubble();
                          return _MessageBubble(message: _messages[i], charId: widget.charId);
                        },
                      ),
          ),
          _buildComposer(),
        ],
      ),
    );
  }

  Widget _buildComposer() {
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        color: const Color(0xFF0B141A),
        child: Row(
          children: [
            Expanded(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                decoration: BoxDecoration(color: const Color(0xFF1F2C34), borderRadius: BorderRadius.circular(26)),
                child: _recording
                    ? Row(
                        children: [
                          const Icon(Icons.fiber_manual_record, color: Colors.redAccent, size: 14),
                          const SizedBox(width: 8),
                          const Expanded(child: Text('Recording…', style: TextStyle(color: AppColors.textSecondary))),
                          GestureDetector(
                            onTap: _cancelRecording,
                            child: const Padding(
                              padding: EdgeInsets.symmetric(vertical: 12),
                              child: Text('Cancel', style: TextStyle(color: AppColors.pink, fontSize: 13)),
                            ),
                          ),
                        ],
                      )
                    : TextField(
                        controller: _controller,
                        minLines: 1,
                        maxLines: 5,
                        style: const TextStyle(color: AppColors.textPrimary),
                        decoration: const InputDecoration(
                          hintText: 'Message',
                          hintStyle: TextStyle(color: AppColors.textFaint),
                          border: InputBorder.none,
                        ),
                        onChanged: (_) => setState(() {}),
                        onSubmitted: (_) => _send(),
                      ),
              ),
            ),
            const SizedBox(width: 8),
            GestureDetector(
              onLongPressStart: (_) => _startRecording(),
              onLongPressEnd: (_) => _stopRecordingAndSend(),
              child: Container(
                decoration: BoxDecoration(
                  gradient: _recording ? null : AppColors.gradient,
                  color: _recording ? Colors.redAccent : null,
                  shape: BoxShape.circle,
                ),
                child: IconButton(
                  icon: Icon(
                    _controller.text.trim().isEmpty && !_recording
                        ? Icons.mic
                        : (_sending ? Icons.hourglass_top : Icons.send),
                    color: Colors.white,
                    size: 20,
                  ),
                  onPressed: _sending
                      ? null
                      : (_controller.text.trim().isEmpty && !_recording ? null : () => _send()),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MessageBubble extends StatefulWidget {
  const _MessageBubble({required this.message, required this.charId});
  final ChatMessageItem message;
  final String charId;

  @override
  State<_MessageBubble> createState() => _MessageBubbleState();
}

class _MessageBubbleState extends State<_MessageBubble> {
  final _player = AudioPlayer();
  bool _loadingVoice = false;

  @override
  void dispose() {
    _player.dispose();
    super.dispose();
  }

  Future<void> _playTts() async {
    if (_loadingVoice) return;
    setState(() => _loadingVoice = true);
    try {
      final bytes = await VoiceService.textToSpeech(charId: widget.charId, text: widget.message.text ?? '');
      await _player.play(BytesSource(bytes));
    } catch (e) {
      final isOutOfCredits = e is DioException && e.response?.statusCode == 402;
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(isOutOfCredits ? 'Not enough credits for voice (2 needed).' : 'Voice unavailable right now.')),
        );
      }
    } finally {
      if (mounted) setState(() => _loadingVoice = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final message = widget.message;
    final isUser = message.sender == ChatSender.user;
    final bubbleColor = isUser ? const Color(0xFF005C4B) : const Color(0xFF202C33);

    Widget content;
    switch (message.type) {
      case ChatContentType.image:
        content = ClipRRect(
          borderRadius: BorderRadius.circular(10),
          child: CachedNetworkImage(
            imageUrl: Env.media(message.url),
            width: 220,
            height: 260,
            fit: BoxFit.cover,
            placeholder: (_, __) => Container(
              width: 220,
              height: 260,
              color: Colors.black26,
              child: const Center(child: CircularProgressIndicator(color: AppColors.pink, strokeWidth: 2)),
            ),
            errorWidget: (_, __, ___) => Container(
              width: 220,
              height: 120,
              color: Colors.black26,
              alignment: Alignment.center,
              child: const Text('Failed to load image', style: TextStyle(color: Colors.redAccent, fontSize: 12)),
            ),
          ),
        );
        break;
      case ChatContentType.audio:
        content = Row(
          mainAxisSize: MainAxisSize.min,
          children: const [
            Icon(Icons.graphic_eq, color: AppColors.textSecondary, size: 18),
            SizedBox(width: 6),
            Text('Voice message', style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
          ],
        );
        break;
      case ChatContentType.text:
        content = Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(message.text ?? '', style: const TextStyle(color: AppColors.textPrimary, fontSize: 15, height: 1.3)),
            if (!isUser)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: InkWell(
                  onTap: _playTts,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(_loadingVoice ? '⏳' : '🎤', style: const TextStyle(fontSize: 13)),
                      const SizedBox(width: 4),
                      const Text('2cr', style: TextStyle(fontSize: 10, color: AppColors.textFaint)),
                    ],
                  ),
                ),
              ),
          ],
        );
    }

    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.all(10),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
        decoration: BoxDecoration(
          color: bubbleColor,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(12),
            topRight: const Radius.circular(12),
            bottomLeft: Radius.circular(isUser ? 12 : 2),
            bottomRight: Radius.circular(isUser ? 2 : 12),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            content,
            if (message.failed)
              const Padding(
                padding: EdgeInsets.only(top: 4),
                child: Text('Not sent', style: TextStyle(color: Colors.redAccent, fontSize: 11)),
              ),
          ],
        ),
      ),
    );
  }
}

class _TypingBubble extends StatelessWidget {
  const _TypingBubble();

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(color: const Color(0xFF202C33), borderRadius: BorderRadius.circular(12)),
        child: const SizedBox(
          width: 30,
          height: 12,
          child: _Dots(),
        ),
      ),
    );
  }
}

class _Dots extends StatefulWidget {
  const _Dots();
  @override
  State<_Dots> createState() => _DotsState();
}

class _DotsState extends State<_Dots> with SingleTickerProviderStateMixin {
  late final AnimationController _c =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 900))..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _c,
      builder: (context, _) {
        return Row(
          mainAxisSize: MainAxisSize.min,
          children: List.generate(3, (i) {
            final t = (_c.value + i * 0.2) % 1.0;
            final scale = 0.6 + 0.4 * (1 - (t - 0.5).abs() * 2).clamp(0.0, 1.0);
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 2),
              child: Transform.scale(
                scale: scale,
                child: Container(width: 6, height: 6, decoration: const BoxDecoration(color: AppColors.teal, shape: BoxShape.circle)),
              ),
            );
          }),
        );
      },
    );
  }
}
