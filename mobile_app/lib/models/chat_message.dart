enum ChatSender { user, ai }

enum ChatContentType { text, image, audio }

class ChatMessageItem {
  ChatMessageItem({
    required this.sender,
    required this.type,
    this.text,
    this.url,
    this.time,
    this.isEncrypted = false,
    this.pending = false,
    this.failed = false,
  });

  final ChatSender sender;
  final ChatContentType type;
  final String? text;
  final String? url;
  final String? time;
  final bool isEncrypted;
  bool pending;
  bool failed;

  factory ChatMessageItem.fromJson(Map<String, dynamic> json) {
    return ChatMessageItem(
      sender: json['sender'] == 'user' ? ChatSender.user : ChatSender.ai,
      type: switch (json['type']) {
        'image' => ChatContentType.image,
        'audio' => ChatContentType.audio,
        _ => ChatContentType.text,
      },
      text: json['text'],
      url: json['url'],
      time: json['time']?.toString(),
      isEncrypted: json['is_encrypted'] == true,
    );
  }
}
