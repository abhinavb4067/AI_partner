import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import '../../core/api_client.dart';
import '../../core/crypto_service.dart';
import '../../core/env.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/ws_service.dart';
import '../../models/human_message.dart';
import '../../services/call_manager.dart';
import '../../services/social_service.dart';
import '../../widgets/gradient_avatar.dart';

class HumanChatScreen extends StatefulWidget {
  const HumanChatScreen({super.key, required this.targetId, this.peer});
  final String targetId;
  final SocialUser? peer;

  @override
  State<HumanChatScreen> createState() => _HumanChatScreenState();
}

class _HumanChatScreenState extends State<HumanChatScreen> {
  final _messages = <HumanMessage>[];
  final _controller = TextEditingController();
  final _scroll = ScrollController();
  StreamSubscription? _wsSub;
  SocialUser? _peer;
  String? _peerPublicKey;
  bool _loading = true;
  bool _sendingImage = false;

  @override
  void initState() {
    super.initState();
    _peer = widget.peer;
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    // 1. Register our own key + fetch the peer's (idempotent, matches web behavior).
    try {
      await SocialService.registerPublicKey(CryptoService.instance.myPublicKeyBase64);
      _peerPublicKey = await SocialService.getPublicKey(widget.targetId);
    } catch (_) {
      // Fall back to plaintext if key exchange fails — chat still works.
    }

    // 2. Fetch peer profile (for header) if we weren't handed one already.
    _peer ??= await SocialService.getUser(widget.targetId);

    // 3. Load + decrypt history.
    try {
      final history = await SocialService.getHistory(widget.targetId);
      for (final m in history) {
        if (m.messageType != 'view_once') {
          m.content = CryptoService.instance.decryptChatMessage(m.content, peerPublicKeyB64: _peerPublicKey);
        }
      }
      setState(() => _messages.addAll(history));
    } catch (_) {}

    setState(() => _loading = false);
    _scrollToBottom();
    _markUnreadAsRead();

    // 4. Subscribe to the shared socket for this conversation's messages.
    _wsSub = WsService.instance.messages.listen(_onSocketMessage);
  }

  void _onSocketMessage(Map<String, dynamic> data) {
    final type = data['type'];
    if (type == 'new_message') {
      final msg = HumanMessage.fromJson(data['message'] as Map<String, dynamic>);
      final belongsHere = msg.senderId == widget.targetId || msg.receiverId == widget.targetId;
      if (!belongsHere) return;
      if (msg.messageType != 'view_once') {
        msg.content = CryptoService.instance.decryptChatMessage(msg.content, peerPublicKeyB64: _peerPublicKey);
      }
      setState(() => _messages.add(msg));
      _scrollToBottom();
      if (msg.senderId == widget.targetId) {
        WsService.instance.send({'type': 'read', 'message_id': msg.id});
      }
    } else if (type == 'message_viewed' || type == 'message_read') {
      final id = data['message_id'];
      setState(() {
        for (final m in _messages) {
          if (m.id == id) {
            m.isViewed = true;
            if (type == 'message_viewed') m.content = '[VIEWED]';
          }
        }
      });
    }
  }

  void _markUnreadAsRead() {
    for (final m in _messages) {
      if (m.senderId == widget.targetId && !m.isViewed) {
        WsService.instance.send({'type': 'read', 'message_id': m.id});
        m.isViewed = true;
      }
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.animateTo(_scroll.position.maxScrollExtent, duration: const Duration(milliseconds: 250), curve: Curves.easeOut);
      }
    });
  }

  void _send() {
    final text = _controller.text.trim();
    if (text.isEmpty) return;
    _controller.clear();

    final content = _peerPublicKey != null ? CryptoService.instance.encryptForPeer(text, _peerPublicKey!) : text;
    WsService.instance.send({'type': 'text', 'target_id': widget.targetId, 'content': content});

    // Optimistic local echo (server also acks back to sender, but this feels instant).
    setState(() => _messages.add(HumanMessage(
          id: DateTime.now().microsecondsSinceEpoch,
          senderId: Session.instance.userId ?? '',
          receiverId: widget.targetId,
          content: text,
          messageType: 'text',
        )));
    _scrollToBottom();
  }

  Future<void> _sendImage() async {
    final picker = ImagePicker();
    final file = await picker.pickImage(source: ImageSource.gallery, imageQuality: 80);
    if (file == null) return;
    setState(() => _sendingImage = true);
    try {
      final url = await SocialService.uploadChatImage(File(file.path));
      WsService.instance.send({'type': 'view_once', 'target_id': widget.targetId, 'content': url});
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(apiErrorMessage(e, fallback: 'Failed to send image.'))));
      }
    } finally {
      if (mounted) setState(() => _sendingImage = false);
    }
  }

  void _markViewed(HumanMessage m) {
    WsService.instance.send({'type': 'viewed', 'message_id': m.id});
    setState(() {
      m.isViewed = true;
      m.content = '[VIEWED]';
    });
  }

  void _call(bool video) {
    CallManager.instance.startOutgoingCall(
      targetId: widget.targetId,
      targetName: _peer?.name ?? _peer?.username ?? 'Someone',
      targetAvatarUrl: _peer?.avatarUrl,
      video: video,
    );
    context.push('/call');
  }

  @override
  void dispose() {
    _wsSub?.cancel();
    _controller.dispose();
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final name = _peer?.name ?? _peer?.username ?? 'Chat';
    return Scaffold(
      backgroundColor: const Color(0xFF0B141A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF202C33),
        titleSpacing: 0,
        title: Row(
          children: [
            GradientAvatar(name: name, photoUrl: Env.media(_peer?.avatarUrl), size: 38),
            const SizedBox(width: 12),
            Expanded(child: Text(name, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600), overflow: TextOverflow.ellipsis)),
          ],
        ),
        actions: [
          IconButton(icon: const Icon(Icons.call), onPressed: () => _call(false)),
          IconButton(icon: const Icon(Icons.videocam), onPressed: () => _call(true)),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: AppColors.pink))
                : ListView.builder(
                    controller: _scroll,
                    padding: const EdgeInsets.all(12),
                    itemCount: _messages.length,
                    itemBuilder: (context, i) => _bubble(_messages[i]),
                  ),
          ),
          SafeArea(
            top: false,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              color: const Color(0xFF0B141A),
              child: Row(
                children: [
                  IconButton(
                    icon: _sendingImage
                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.image_outlined, color: AppColors.textSecondary),
                    onPressed: _sendingImage ? null : _sendImage,
                  ),
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      decoration: BoxDecoration(color: const Color(0xFF1F2C34), borderRadius: BorderRadius.circular(26)),
                      child: TextField(
                        controller: _controller,
                        style: const TextStyle(color: AppColors.textPrimary),
                        decoration: const InputDecoration(hintText: 'Message', hintStyle: TextStyle(color: AppColors.textFaint), border: InputBorder.none),
                        onSubmitted: (_) => _send(),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    decoration: const BoxDecoration(gradient: AppColors.gradient, shape: BoxShape.circle),
                    child: IconButton(icon: const Icon(Icons.send, color: Colors.white, size: 20), onPressed: _send),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _bubble(HumanMessage m) {
    final isMe = m.senderId == Session.instance.userId;
    if (m.messageType == 'missed_call') {
      return Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
            decoration: BoxDecoration(color: AppColors.bgElevated, borderRadius: BorderRadius.circular(12)),
            child: Text(m.content, style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
          ),
        ),
      );
    }

    Widget content;
    if (m.messageType == 'view_once') {
      final revealed = isMe || m.content != '[VIEWED]';
      content = GestureDetector(
        onTap: (!isMe && m.content != '[VIEWED]') ? () => _markViewed(m) : null,
        child: revealed && m.content.startsWith('/')
            ? ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: Image.network(Env.media(m.content), width: 200, height: 240, fit: BoxFit.cover),
              )
            : Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.camera_alt, size: 16, color: AppColors.textSecondary),
                  const SizedBox(width: 6),
                  Text(m.content == '[VIEWED]' ? 'Photo viewed' : 'Tap to view photo', style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                ],
              ),
      );
    } else {
      content = Text(m.content, style: const TextStyle(color: AppColors.textPrimary, fontSize: 15, height: 1.3));
    }

    return Align(
      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.all(10),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
        decoration: BoxDecoration(
          color: isMe ? const Color(0xFF005C4B) : const Color(0xFF202C33),
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(12),
            topRight: const Radius.circular(12),
            bottomLeft: Radius.circular(isMe ? 12 : 2),
            bottomRight: Radius.circular(isMe ? 2 : 12),
          ),
        ),
        child: content,
      ),
    );
  }
}
