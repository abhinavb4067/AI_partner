class CharacterSummary {
  CharacterSummary({
    required this.id,
    required this.name,
    this.slug,
    this.gender,
    this.about,
    this.photoUrl,
    this.lastMessage,
    this.lastMessageSender,
    this.lastMessageTime,
  });

  final dynamic id; // backend uses int/str depending on model — keep dynamic, stringify at call sites
  final String name;
  final String? slug;
  final String? gender;
  final String? about;
  final String? photoUrl;
  final String? lastMessage;
  final String? lastMessageSender;
  final String? lastMessageTime;

  String get idStr => id.toString();

  factory CharacterSummary.fromJson(Map<String, dynamic> json) {
    return CharacterSummary(
      id: json['id'],
      name: json['name'] ?? '',
      slug: json['slug'],
      gender: json['gender'],
      about: json['about'],
      photoUrl: json['photo_url'],
      lastMessage: json['last_message'],
      lastMessageSender: json['last_message_sender'],
      lastMessageTime: json['last_message_time']?.toString(),
    );
  }
}
