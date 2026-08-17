part of 'chat_room_screen.dart';

class _MessageBubble extends StatelessWidget {
  final Message message;
  final bool isMe;
  final bool isRead;

  const _MessageBubble({
    required this.message,
    required this.isMe,
    required this.isRead,
  });

  @override
  Widget build(BuildContext context) {
    final time = _formatTime(message.createdAt);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: isMe
            ? MainAxisAlignment.end
            : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (!isMe) ...[
            CircleAvatar(
              radius: 14,
              backgroundColor: const Color(0xFF3A2D5A),
              child: Text(
                message.senderId.isNotEmpty
                    ? message.senderId[0].toUpperCase()
                    : '?',
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: Colors.white70,
                ),
              ),
            ),
            const SizedBox(width: 6),
          ],
          Flexible(
            child: Column(
              crossAxisAlignment: isMe
                  ? CrossAxisAlignment.end
                  : CrossAxisAlignment.start,
              children: [
                Container(
                  constraints: BoxConstraints(
                    maxWidth: MediaQuery.of(context).size.width * 0.68,
                  ),
                  padding: message.isText
                      ? const EdgeInsets.symmetric(horizontal: 14, vertical: 10)
                      : EdgeInsets.zero,
                  decoration: message.isText
                      ? BoxDecoration(
                          color: isMe
                              ? const Color(0xFF2A1B3D)
                              : const Color(0xFF262629),
                          borderRadius: BorderRadius.only(
                            topLeft: const Radius.circular(18),
                            topRight: const Radius.circular(18),
                            bottomLeft: Radius.circular(isMe ? 18 : 4),
                            bottomRight: Radius.circular(isMe ? 4 : 18),
                          ),
                          border: isMe
                              ? null
                              : Border.all(
                                  color: Colors.white.withOpacity(0.08),
                                ),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.4),
                              blurRadius: 6,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        )
                      : null,
                  child: message.isText
                      ? Text(
                          message.textContent ?? '',
                          style: TextStyle(
                            color: isMe
                                ? Colors.white
                                : Colors.white.withValues(alpha: 0.88),
                            fontSize: 15,
                            height: 1.4,
                          ),
                        )
                      : _MediaContent(message: message),
                ),
                const SizedBox(height: 3),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (isRead)
                      const Text(
                        '읽음',
                        style: TextStyle(fontSize: 10, color: Colors.grey),
                      ),
                    if (isRead) const SizedBox(width: 4),
                    Text(
                      time,
                      style: const TextStyle(fontSize: 10, color: Colors.white30),
                    ),
                  ],
                ),
              ],
            ),
          ),
          if (isMe) const SizedBox(width: 6),
        ],
      ),
    );
  }

  String _formatTime(DateTime dt) {
    final local = dt.toLocal();
    final h = local.hour.toString().padLeft(2, '0');
    final m = local.minute.toString().padLeft(2, '0');
    return '$h:$m';
  }
}

// ─── 미디어 콘텐츠 ────────────────────────────────────────────────────────────

class _MediaContent extends StatelessWidget {
  final Message message;

  const _MediaContent({required this.message});

  @override
  Widget build(BuildContext context) {
    if (message.media.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.grey[200],
          borderRadius: BorderRadius.circular(14),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.image, color: Colors.grey, size: 20),
            const SizedBox(width: 8),
            Text(
              '미디어 (${message.permissionLabel})',
              style: const TextStyle(color: Colors.grey, fontSize: 13),
            ),
          ],
        ),
      );
    }

    final chat = context.read<ChatProvider>();
    final isRestricted =
        message.permissionType == 'once' || message.permissionType == 'replay_once';

    // once / replay_once: 썸네일 없이 열람 버튼만 표시
    if (isRestricted) {
      return _RestrictedMediaButton(message: message, chat: chat);
    }

    // keep: 기존 썸네일 그리드
    final previews = message.media.take(4).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
            color: const Color(0xFF2E7D32),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text(
            message.permissionLabel,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 10,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        const SizedBox(height: 4),
        Wrap(
          spacing: 4,
          runSpacing: 4,
          children: [
            for (final entry in previews.asMap().entries)
              _MediaThumb(
                message: message,
                chat: chat,
                mediaIndex: entry.key,
                mediaUrl: entry.value.url,
              ),
          ],
        ),
        if (message.media.length > 4)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              '+${message.media.length - 4}장',
              style: const TextStyle(color: Colors.grey, fontSize: 12),
            ),
          ),
      ],
    );
  }
}

// once / replay_once 전용 열람 버튼
class _RestrictedMediaButton extends StatelessWidget {
  final Message message;
  final ChatProvider chat;

  const _RestrictedMediaButton({required this.message, required this.chat});

  @override
  Widget build(BuildContext context) {
    final canView = message.canView;
    final isVideo = message.media.isNotEmpty &&
        message.media.first.mimeType.startsWith('video');
    final count = message.media.length;

    final String label;
    if (!canView) {
      label = '열람 횟수 초과';
    } else if (isVideo) {
      label = '동영상 보기';
    } else if (count > 1) {
      label = '사진 ${count}장 보기';
    } else {
      label = '사진 보기';
    }

    final badgeColor = message.permissionType == 'once'
        ? const Color(0xFFB71C1C)
        : const Color(0xFFE65100);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        // 권한 배지
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
            color: badgeColor,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text(
            message.permissionLabel,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 10,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        const SizedBox(height: 8),
        // 열람 버튼
        GestureDetector(
          onTap: canView ? () => _open(context) : null,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              color: canView ? const Color(0xFF0084FF) : Colors.grey[300],
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  canView
                      ? (isVideo
                          ? Icons.play_circle_filled
                          : Icons.photo_rounded)
                      : Icons.lock_outline_rounded,
                  color: canView ? Colors.white : Colors.grey,
                  size: 16,
                ),
                const SizedBox(width: 6),
                Text(
                  label,
                  style: TextStyle(
                    color: canView ? Colors.white : Colors.grey,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Future<void> _open(BuildContext context) async {
    final navigator = Navigator.of(context);
    final messenger = ScaffoldMessenger.of(context);

    final access = await chat.accessMedia(message.id);
    if (!navigator.mounted || !messenger.mounted) return;
    if (access.error != null) {
      messenger.showSnackBar(SnackBar(content: Text(access.error!)));
      return;
    }

    if (!navigator.mounted) return;
    await navigator.push(
      MaterialPageRoute(
        builder: (_) => _MediaViewerScreen(
          mediaUrls: access.urls,
          mimeTypes: message.media.map((m) => m.mimeType).toList(),
          initialIndex: 0,
          permissionLabel: message.permissionLabel,
        ),
      ),
    );
  }
}

class _MediaThumb extends StatelessWidget {
  final Message message;
  final ChatProvider chat;
  final int mediaIndex;
  final String mediaUrl;

  const _MediaThumb({
    required this.message,
    required this.chat,
    required this.mediaIndex,
    required this.mediaUrl,
  });

  @override
  Widget build(BuildContext context) {
    final canOpen = message.canView;
    final isVideo =
        message.media[mediaIndex].mimeType.startsWith('video/');

    return GestureDetector(
      onTap: canOpen ? () => _openMedia(context) : null,
      child: Stack(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: isVideo
                ? Container(
                    width: 120,
                    height: 120,
                    color: Colors.black87,
                    child: const Center(
                      child: Icon(
                        Icons.play_circle_filled,
                        color: Colors.white70,
                        size: 40,
                      ),
                    ),
                  )
                : Image.network(
                    mediaUrl,
                    width: 120,
                    height: 120,
                    fit: BoxFit.cover,
                    errorBuilder: (context, error, stack) {
                      Log.e('IMAGE', '이미지 로드 실패: $mediaUrl', error, stack);
                      return Container(
                        width: 120,
                        height: 120,
                        color: Colors.grey[200],
                        child:
                            const Icon(Icons.broken_image, color: Colors.grey),
                      );
                    },
                  ),
          ),
          Positioned(
            right: 6,
            bottom: 6,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.55),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Icon(
                canOpen
                    ? Icons.open_in_full_rounded
                    : Icons.lock_outline_rounded,
                size: 12,
                color: Colors.white,
              ),
            ),
          ),
          if (!canOpen)
            Positioned.fill(
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Future<void> _openMedia(BuildContext context) async {
    var mediaUrls = message.media.map((m) => m.url).toList();
    final navigator = Navigator.of(context);
    final messenger = ScaffoldMessenger.of(context);

    if (message.permissionType != 'keep') {
      final access = await chat.accessMedia(message.id);
      if (!navigator.mounted || !messenger.mounted) return;
      if (access.error != null) {
        messenger.showSnackBar(SnackBar(content: Text(access.error!)));
        return;
      }
      mediaUrls = access.urls;
    }

    if (!navigator.mounted) return;
    final startIndex = mediaIndex.clamp(0, mediaUrls.length - 1).toInt();
    await navigator.push(
      MaterialPageRoute(
        builder: (_) => _MediaViewerScreen(
          mediaUrls: mediaUrls,
          mimeTypes: message.media.map((m) => m.mimeType).toList(),
          initialIndex: startIndex,
          permissionLabel: message.permissionLabel,
        ),
      ),
    );
  }
}
