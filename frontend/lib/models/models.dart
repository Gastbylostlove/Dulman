class MediaItem {
  final int mediaId;
  final String url;
  final String mimeType;

  const MediaItem({required this.mediaId, required this.url, required this.mimeType});

  factory MediaItem.fromJson(Map<String, dynamic> j) => MediaItem(
        mediaId: j['media_id'] as int,
        url: j['url'] as String,
        mimeType: j['mime_type'] as String,
      );

  MediaItem copyWith({String? url}) => MediaItem(
        mediaId: mediaId,
        url: url ?? this.url,
        mimeType: mimeType,
      );
}

class Message {
  final int id;
  final String senderId;
  final String type; // 'text' | 'media'
  final String? textContent;
  final String? permissionType; // 'once' | 'replay_once' | 'keep'
  final int viewCount;
  final List<MediaItem> media;
  final DateTime createdAt;

  const Message({
    required this.id,
    required this.senderId,
    required this.type,
    this.textContent,
    this.permissionType,
    required this.viewCount,
    required this.media,
    required this.createdAt,
  });

  factory Message.fromJson(Map<String, dynamic> j) => Message(
        id: j['id'] as int,
        senderId: j['sender_id'] as String,
        type: j['type'] as String,
        textContent: j['text_content'] as String?,
        permissionType: j['permission_type'] as String?,
        viewCount: j['view_count'] as int? ?? 0,
        media: (j['media'] as List<dynamic>? ?? [])
            .map((m) => MediaItem.fromJson(m as Map<String, dynamic>))
            .toList(),
        createdAt: DateTime.parse(j['created_at'] as String),
      );

  Message copyWith({List<MediaItem>? media}) => Message(
        id: id,
        senderId: senderId,
        type: type,
        textContent: textContent,
        permissionType: permissionType,
        viewCount: viewCount,
        media: media ?? this.media,
        createdAt: createdAt,
      );

  bool get isText => type == 'text';
  bool get isMedia => type == 'media';

  // 열람 가능 여부
  bool get canView {
    if (!isMedia) return true;
    if (permissionType == 'keep') return true;
    if (permissionType == 'once') return viewCount < 1;
    if (permissionType == 'replay_once') return viewCount < 2;
    return false;
  }

  String get permissionLabel {
    switch (permissionType) {
      case 'once': return '일회용';
      case 'replay_once': return '다시보기';
      case 'keep': return '보관';
      default: return '';
    }
  }
}

class ActiveChat {
  final int? activeChatId;
  final String? status;
  final String? userAId;
  final String? userBId;
  final DateTime? lastResetAt;

  const ActiveChat({
    this.activeChatId,
    this.status,
    this.userAId,
    this.userBId,
    this.lastResetAt,
  });

  factory ActiveChat.fromJson(Map<String, dynamic> j) => ActiveChat(
        activeChatId: j['active_chat_id'] as int?,
        status: j['status'] as String?,
        userAId: j['user_a_id'] as String?,
        userBId: j['user_b_id'] as String?,
        lastResetAt: j['last_reset_at'] != null
            ? DateTime.parse(j['last_reset_at'] as String)
            : null,
      );

  bool get isActive => status == 'active';
  bool get isWaiting => status == 'waiting';
}
