import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:video_player/video_player.dart';
import '../providers/auth_provider.dart';
import '../providers/chat_provider.dart';
import '../models/models.dart';
import '../core/logger.dart';
import 'auth_screen.dart';
import 'onboarding_screen.dart';

part '_chat_message_bubble.dart';
part '_chat_media_viewer.dart';
part '_chat_input_bar.dart';

class ChatRoomScreen extends StatefulWidget {
  const ChatRoomScreen({super.key});

  @override
  State<ChatRoomScreen> createState() => _ChatRoomScreenState();
}

class _ChatRoomScreenState extends State<ChatRoomScreen>
    with WidgetsBindingObserver {
  final _textCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  final _picker = ImagePicker();
  int _lastMarkedMessageId = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    context.read<ChatProvider>().addListener(_onChatChange);
    WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToBottom(force: true));
    _scrollCtrl.addListener(_onScroll);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && mounted) {
      context.read<ChatProvider>().loadActiveChat();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    context.read<ChatProvider>().removeListener(_onChatChange);
    _scrollCtrl.removeListener(_onScroll);
    _textCtrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_scrollCtrl.hasClients) return;
    if (_scrollCtrl.position.pixels <= 80) {
      context.read<ChatProvider>().loadOlderMessages();
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
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _scrollToBottom();
      final lastMessageId = chat.messages.isEmpty ? 0 : chat.messages.last.id;
      if (mounted && lastMessageId > _lastMarkedMessageId) {
        _lastMarkedMessageId = lastMessageId;
        context.read<ChatProvider>().markRead();
      }
    });
  }

  Future<void> _handleForcedLogout() async {
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
    _scrollToBottom(force: true);
  }

  Future<void> _handleMedia() async {
    // 1. 미디어 타입 선택 (사진 / 동영상)
    final mediaType = await showModalBottomSheet<String>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => const _MediaTypePicker(),
    );
    if (mediaType == null || !mounted) return;

    List<XFile> picked;
    if (mediaType == 'video') {
      final video = await _picker.pickVideo(source: ImageSource.gallery);
      if (video == null || !mounted) return;
      picked = [video];
    } else {
      picked = await _picker.pickMultiImage(limit: 10);
      if (picked.isEmpty || !mounted) return;
    }

    // 2. 열람 권한 선택
    final permission = await showModalBottomSheet<String>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => const _PermissionPicker(),
    );
    if (permission == null || !mounted) return;
    await context.read<ChatProvider>().sendMedia(picked, permission);
  }

  Future<bool> _confirm(String title, String content, String confirmLabel) {
    return showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(title),
        content: Text(content),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('취소'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(
              confirmLabel,
              style: const TextStyle(color: Color(0xFFAE2F34)),
            ),
          ),
        ],
      ),
    ).then((v) => v == true);
  }

  Future<void> _handleReset() async {
    final chat = context.read<ChatProvider>();
    final messenger = ScaffoldMessenger.of(context);
    if (!await _confirm('대화 초기화', '모든 대화 내역이 화면에서 사라집니다.\n서버 데이터는 보존됩니다. 계속하시겠습니까?', '초기화')) return;
    final err = await chat.resetChat();
    if (err != null && mounted) {
      messenger.showSnackBar(SnackBar(content: Text('초기화 실패: $err')));
    }
  }

  Future<void> _handleLeave() async {
    final chat = context.read<ChatProvider>();
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);
    if (!await _confirm('채팅방 나가기', '채팅방을 나가면 연결이 종료됩니다.\n이 작업은 되돌릴 수 없습니다.', '나가기')) return;
    final err = await chat.leaveChat();
    if (err != null && mounted) {
      messenger.showSnackBar(SnackBar(content: Text('나가기 실패: $err')));
      return;
    }
    if (!mounted) return;
    navigator.pushReplacement(
      MaterialPageRoute(builder: (_) => const OnboardingScreen()),
    );
  }

  bool get _isNearBottom {
    if (!_scrollCtrl.hasClients) return true;
    final pos = _scrollCtrl.position;
    return pos.maxScrollExtent - pos.pixels < 120;
  }

  void _scrollToBottom({bool force = false}) {
    if (_scrollCtrl.hasClients && (force || _isNearBottom)) {
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
        title: Text(
          '채팅방 #${chat.chatId ?? "-"}',
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
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
                    itemCount: chat.messages.length + (chat.hasOlderMessages ? 1 : 0),
                    itemBuilder: (_, i) {
                      if (chat.hasOlderMessages && i == 0) {
                        return Padding(
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          child: Center(
                            child: chat.isLoadingOlder
                                ? const SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(strokeWidth: 2),
                                  )
                                : const SizedBox.shrink(),
                          ),
                        );
                      }
                      final msgIndex = chat.hasOlderMessages ? i - 1 : i;
                      final msg = chat.messages[msgIndex];
                      return _MessageBubble(
                        message: msg,
                        isMe: msg.senderId == myId,
                        isRead: msg.senderId == myId && chat.isMessageRead(msg.id),
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

