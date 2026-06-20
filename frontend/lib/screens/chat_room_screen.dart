import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/chat_provider.dart';
import '../models/models.dart';
import '../core/api_client.dart';
import 'auth_screen.dart';
import 'onboarding_screen.dart';

// FLAG_SECURE 제어용 MethodChannel (Android 캡처 차단)
const _windowChannel = MethodChannel('com.dulman/window_flags');

class ChatRoomScreen extends StatefulWidget {
  const ChatRoomScreen({super.key});

  @override
  State<ChatRoomScreen> createState() => _ChatRoomScreenState();
}

class _ChatRoomScreenState extends State<ChatRoomScreen> {
  final _textCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  final _picker = ImagePicker();

  @override
  void initState() {
    super.initState();
    _applySecureFlag(true);
    context.read<ChatProvider>().addListener(_onChatChange);
  }

  @override
  void dispose() {
    _applySecureFlag(false);
    context.read<ChatProvider>().removeListener(_onChatChange);
    _textCtrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  Future<void> _applySecureFlag(bool secure) async {
    try {
      if (secure) {
        await _windowChannel.invokeMethod('addSecureFlag');
      } else {
        await _windowChannel.invokeMethod('clearSecureFlag');
      }
    } catch (_) {
      // 에뮬레이터 또는 iOS에서는 무시
    }
  }

  void _onChatChange() {
    final chat = context.read<ChatProvider>();
    if (chat.forcedLogout) {
      _handleForcedLogout();
      return;
    }
    if (chat.state == ChatState.ended) {
      _handlePartnerLeft();
      return;
    }
    // 새 메시지 도착 시 스크롤
    WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToBottom());
  }

  void _handleForcedLogout() async {
    context.read<ChatProvider>().clearForcedLogout();
    await context.read<AuthProvider>().logout();
    if (!mounted) return;
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => AlertDialog(
        title: const Text('보안 알림'),
        content: const Text('다른 기기에서 로그인되어 현재 세션이 종료되었습니다.'),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              Navigator.of(context).pushReplacement(
                MaterialPageRoute(builder: (_) => const AuthScreen()),
              );
            },
            child: const Text('확인'),
          ),
        ],
      ),
    );
  }

  void _handlePartnerLeft() {
    context.read<ChatProvider>().endChatLocally();
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => AlertDialog(
        title: const Text('채팅 종료'),
        content: const Text('상대방이 채팅방을 나갔습니다.'),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              Navigator.of(context).pushReplacement(
                MaterialPageRoute(builder: (_) => const OnboardingScreen()),
              );
            },
            child: const Text('확인'),
          ),
        ],
      ),
    );
  }

  Future<void> _handleSend() async {
    final text = _textCtrl.text.trim();
    if (text.isEmpty) return;
    _textCtrl.clear();
    await context.read<ChatProvider>().sendText(text);
    _scrollToBottom();
  }

  Future<void> _handleMedia() async {
    final picked = await _picker.pickMultiImage(limit: 10);
    if (picked.isEmpty || !mounted) return;

    // 권한 타입 선택 다이얼로그
    final permission = await showModalBottomSheet<String>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => const _PermissionPicker(),
    );

    if (permission == null || !mounted) return;
    await _sendMedia(picked, permission);
  }

  Future<void> _sendMedia(List<XFile> files, String permissionType) async {
    final chat = context.read<ChatProvider>();
    final auth = context.read<AuthProvider>();
    if (auth.accessToken == null || chat.chatId == null) return;

    // 1. 업로드 인텐트 발급
    final fileInfos = files.map((f) {
      final ext = f.name.split('.').last.toLowerCase();
      final mime = ext == 'mp4' ? 'video/mp4' : 'image/jpeg';
      final bytes = File(f.path).lengthSync();
      return {'client_file_id': f.name, 'mime_type': mime, 'byte_size': bytes};
    }).toList();

    try {
      final intentResult = await ApiClient.createMediaUploadIntent(
        auth.accessToken!,
        chat.chatId!,
        fileInfos,
      );

      // 2. 실제 업로드는 스토리지 백엔드 없이 스킵 (MVP)
      // 3. 메시지 전송 (mock URL로)
      final uploadItems = intentResult['upload_items'] as List<dynamic>;
      final mediaItems = uploadItems.map((item) {
        return {
          'url': item['media_url'] as String,
          'mime_type': item['mime_type'] as String,
        };
      }).toList();

      await ApiClient.sendMediaMessage(
        auth.accessToken!,
        chat.chatId!,
        permissionType,
        mediaItems.cast<Map<String, String>>(),
      );

      await chat.refreshMessages();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('미디어 전송 실패: ${e.message}')));
    }
  }

  Future<void> _handleReset() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('대화 초기화'),
        content: const Text('모든 대화 내역이 화면에서 사라집니다.\n서버 데이터는 보존됩니다. 계속하시겠습니까?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('취소'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text(
              '초기화',
              style: TextStyle(color: Color(0xFFAE2F34)),
            ),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    final err = await context.read<ChatProvider>().resetChat();
    if (err != null && mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('초기화 실패: $err')));
    }
  }

  Future<void> _handleLeave() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('채팅방 나가기'),
        content: const Text('채팅방을 나가면 연결이 종료됩니다.\n이 작업은 되돌릴 수 없습니다.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('취소'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text(
              '나가기',
              style: TextStyle(color: Color(0xFFAE2F34)),
            ),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    final err = await context.read<ChatProvider>().leaveChat();
    if (err != null && mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('나가기 실패: $err')));
      return;
    }
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const OnboardingScreen()),
    );
  }

  void _scrollToBottom() {
    if (_scrollCtrl.hasClients) {
      _scrollCtrl.animateTo(
        _scrollCtrl.position.maxScrollExtent,
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final chat = context.watch<ChatProvider>();
    final auth = context.watch<AuthProvider>();
    final myId = auth.loginId ?? '';

    return Scaffold(
      backgroundColor: const Color(0xFFF5F0EA),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '채팅방 #${chat.chatId ?? "-"}',
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
            ),
            const Text(
              '🔒 E2EE 보호 중',
              style: TextStyle(fontSize: 11, color: Color(0xFFAE2F34)),
            ),
          ],
        ),
        actions: [
          PopupMenuButton<String>(
            onSelected: (v) {
              if (v == 'reset') _handleReset();
              if (v == 'leave') _handleLeave();
            },
            itemBuilder: (_) => [
              const PopupMenuItem(value: 'reset', child: Text('대화 초기화')),
              const PopupMenuItem(
                value: 'leave',
                child: Text(
                  '채팅방 나가기',
                  style: TextStyle(color: Color(0xFFAE2F34)),
                ),
              ),
            ],
          ),
        ],
      ),
      body: Column(
        children: [
          // 전송 오류 배너
          if (chat.sendError != null)
            MaterialBanner(
              content: Text(
                chat.sendError!,
                style: const TextStyle(fontSize: 13),
              ),
              actions: [
                TextButton(
                  onPressed: chat.clearSendError,
                  child: const Text('닫기'),
                ),
              ],
            ),
          // 메시지 목록
          Expanded(
            child: chat.messages.isEmpty
                ? const Center(
                    child: Text(
                      '첫 메시지를 보내보세요!',
                      style: TextStyle(color: Colors.grey),
                    ),
                  )
                : ListView.builder(
                    controller: _scrollCtrl,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 12,
                    ),
                    itemCount: chat.messages.length,
                    itemBuilder: (_, i) {
                      final msg = chat.messages[i];
                      return _MessageBubble(
                        message: msg,
                        isMe: msg.senderId == myId,
                      );
                    },
                  ),
          ),
          // 입력창
          _InputBar(
            ctrl: _textCtrl,
            sending: chat.isSending,
            onSend: _handleSend,
            onMedia: _handleMedia,
          ),
        ],
      ),
    );
  }
}

// ─── 메시지 버블 ──────────────────────────────────────────────────────────────

class _MessageBubble extends StatelessWidget {
  final Message message;
  final bool isMe;

  const _MessageBubble({required this.message, required this.isMe});

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
              backgroundColor: const Color(0xFFE0E0E0),
              child: Text(
                message.senderId.isNotEmpty
                    ? message.senderId[0].toUpperCase()
                    : '?',
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
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
                          color: isMe ? const Color(0xFFAE2F34) : Colors.white,
                          borderRadius: BorderRadius.only(
                            topLeft: const Radius.circular(18),
                            topRight: const Radius.circular(18),
                            bottomLeft: Radius.circular(isMe ? 18 : 4),
                            bottomRight: Radius.circular(isMe ? 4 : 18),
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.06),
                              blurRadius: 4,
                              offset: const Offset(0, 1),
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
                                : const Color(0xFF1A1A1A),
                            fontSize: 15,
                            height: 1.4,
                          ),
                        )
                      : _MediaContent(message: message),
                ),
                const SizedBox(height: 3),
                Text(
                  time,
                  style: const TextStyle(fontSize: 10, color: Colors.grey),
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

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // 권한 배지
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
            color: const Color(0xFFAE2F34),
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
        // 미디어 그리드 (최대 4개 미리보기)
        Wrap(
          spacing: 4,
          runSpacing: 4,
          children: message.media.take(4).map((m) {
            return ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: Image.network(
                m.url,
                width: 120,
                height: 120,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => Container(
                  width: 120,
                  height: 120,
                  color: Colors.grey[200],
                  child: const Icon(Icons.broken_image, color: Colors.grey),
                ),
              ),
            );
          }).toList(),
        ),
        if (message.media.length > 4)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              '+${message.media.length - 4}장',
              style: const TextStyle(color: Colors.grey, fontSize: 12),
            ),
          ),
        if (!message.canView)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            margin: const EdgeInsets.only(top: 4),
            decoration: BoxDecoration(
              color: Colors.black87,
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Text(
              '열람 횟수 초과',
              style: TextStyle(color: Colors.white, fontSize: 12),
            ),
          ),
      ],
    );
  }
}

// ─── 입력창 ───────────────────────────────────────────────────────────────────

class _InputBar extends StatelessWidget {
  final TextEditingController ctrl;
  final bool sending;
  final VoidCallback onSend;
  final VoidCallback onMedia;

  const _InputBar({
    required this.ctrl,
    required this.sending,
    required this.onSend,
    required this.onMedia,
  });

  @override
  Widget build(BuildContext context) {
    final shortcuts = <ShortcutActivator, Intent>{
      const SingleActivator(LogicalKeyboardKey.enter):
          const _SendMessageIntent(),
      const SingleActivator(LogicalKeyboardKey.numpadEnter):
          const _SendMessageIntent(),
    };

    return Container(
      color: Colors.white,
      padding: EdgeInsets.only(
        left: 8,
        right: 8,
        top: 8,
        bottom: MediaQuery.of(context).viewInsets.bottom + 8,
      ),
      child: Row(
        children: [
          // 미디어 버튼
          IconButton(
            onPressed: onMedia,
            icon: const Icon(
              Icons.photo_library_outlined,
              color: Color(0xFFAE2F34),
            ),
          ),
          // 텍스트 필드
          Expanded(
            child: Shortcuts(
              shortcuts: shortcuts,
              child: Actions(
                actions: {
                  _SendMessageIntent: CallbackAction<_SendMessageIntent>(
                    onInvoke: (_) {
                      if (!sending) onSend();
                      return null;
                    },
                  ),
                },
                child: TextField(
                  controller: ctrl,
                  maxLines: 4,
                  minLines: 1,
                  textInputAction: TextInputAction.send,
                  onSubmitted: (_) => onSend(),
                  decoration: InputDecoration(
                    hintText: '메시지 입력...',
                    hintStyle: const TextStyle(
                      color: Colors.grey,
                      fontSize: 14,
                    ),
                    filled: true,
                    fillColor: const Color(0xFFF5F0EA),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(22),
                      borderSide: BorderSide.none,
                    ),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 10,
                    ),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 6),
          // 전송 버튼
          sending
              ? const Padding(
                  padding: EdgeInsets.all(12),
                  child: SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Color(0xFFAE2F34),
                    ),
                  ),
                )
              : IconButton(
                  onPressed: onSend,
                  icon: const Icon(
                    Icons.send_rounded,
                    color: Color(0xFFAE2F34),
                  ),
                ),
        ],
      ),
    );
  }
}

class _SendMessageIntent extends Intent {
  const _SendMessageIntent();
}

// ─── 미디어 권한 선택 시트 ───────────────────────────────────────────────────────

class _PermissionPicker extends StatelessWidget {
  const _PermissionPicker();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            '열람 권한 선택',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 4),
          const Text(
            '선택한 권한은 이 메시지의 모든 미디어에 적용됩니다.',
            style: TextStyle(fontSize: 12, color: Colors.grey),
          ),
          const SizedBox(height: 20),
          _PermItem(
            label: '일회용',
            icon: Icons.looks_one_rounded,
            description: '1회 열람 후 자동 차단 · 다운로드/캡처 불가',
            value: 'once',
            color: const Color(0xFFB71C1C),
          ),
          const SizedBox(height: 10),
          _PermItem(
            label: '다시보기',
            icon: Icons.replay_circle_filled_rounded,
            description: '2회 열람 가능 · 다운로드/캡처 불가',
            value: 'replay_once',
            color: const Color(0xFFE65100),
          ),
          const SizedBox(height: 10),
          _PermItem(
            label: '보관',
            icon: Icons.lock_open_rounded,
            description: '무제한 열람 · 다운로드/캡처 가능',
            value: 'keep',
            color: const Color(0xFF2E7D32),
          ),
        ],
      ),
    );
  }
}

class _PermItem extends StatelessWidget {
  final String label;
  final IconData icon;
  final String description;
  final String value;
  final Color color;

  const _PermItem({
    required this.label,
    required this.icon,
    required this.description,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => Navigator.pop(context, value),
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: color.withOpacity(0.06),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withOpacity(0.2)),
        ),
        child: Row(
          children: [
            Icon(icon, color: color, size: 24),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: TextStyle(fontWeight: FontWeight.w700, color: color),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    description,
                    style: const TextStyle(fontSize: 12, color: Colors.grey),
                  ),
                ],
              ),
            ),
            Icon(Icons.chevron_right, color: color.withOpacity(0.5)),
          ],
        ),
      ),
    );
  }
}
