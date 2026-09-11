class HumanMessage {
  HumanMessage({
    required this.id,
    required this.senderId,
    required this.receiverId,
    required this.content,
    required this.messageType,
    this.isViewed = false,
    this.isDelivered = true,
    this.createdAt,
  });

  final dynamic id;
  final String senderId;
  final String receiverId;
  String content; // mutable: swapped in-place once decrypted
  final String messageType; // text | image | view_once | missed_call
  bool isViewed;
  bool isDelivered;
  final String? createdAt;

  factory HumanMessage.fromJson(Map<String, dynamic> json) => HumanMessage(
        id: json['id'],
        senderId: json['sender_id'].toString(),
        receiverId: json['receiver_id'].toString(),
        content: json['content'] ?? '',
        messageType: json['message_type'] ?? 'text',
        isViewed: json['is_viewed'] == true,
        isDelivered: json['is_delivered'] != false,
        createdAt: json['created_at']?.toString(),
      );
}
