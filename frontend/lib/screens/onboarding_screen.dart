import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../providers/chat_provider.dart';
import '../providers/auth_provider.dart';
import 'chat_room_screen.dart';
import 'auth_screen.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tab;
  final _inviteInputCtrl = TextEditingController();
  bool _joining = false;
  String? _joinError;
  bool _creating = false;

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: 2, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) => _initChat());
  }

  Future<void> _initChat() async {
    context.read<ChatProvider>().updateAuth(context.read<AuthProvider>());
    final chat = context.read<ChatProvider>();
    if (chat.state == ChatState.idle) {
      setState(() => _creating = true);
      await chat.createChat();
      if (!mounted) return;
      setState(() => _creating = false);
      if (chat.state == ChatState.active) {
        _goToChat();
      }
    } else if (chat.state == ChatState.active) {
      _goToChat();
    }
    // waiting 상태면 폴링이 자동으로 파트너 입장을 감지해 onboarding→chat 전환
    context.read<ChatProvider>().addListener(_onChatStateChange);
  }

  void _onChatStateChange() {
    final chat = context.read<ChatProvider>();
    if (chat.state == ChatState.active && mounted) {
      _goToChat();
    }
    if (chat.forcedLogout && mounted) {
      _handleForcedLogout();
    }
  }

  void _goToChat() {
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const ChatRoomScreen()),
    );
  }

  void _handleForcedLogout() async {
    context.read<ChatProvider>().clearForcedLogout();
    await context.read<AuthProvider>().logout();
    if (!mounted) return;
    _showSecurityAlert();
  }

  void _showSecurityAlert() {
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

  Future<void> _handleJoin() async {
    final code = _inviteInputCtrl.text.trim().toUpperCase();
    if (code.isEmpty) {
      setState(() => _joinError = '초대코드를 입력해주세요.');
      return;
    }
    setState(() {
      _joining = true;
      _joinError = null;
    });
    final chat = context.read<ChatProvider>();
    final err = await chat.joinChat(code);
    if (!mounted) return;
    setState(() => _joining = false);
    if (err != null) {
      setState(() => _joinError = err);
    }
    // 성공하면 _onChatStateChange 에서 자동 라우팅
  }

  @override
  void dispose() {
    context.read<ChatProvider>().removeListener(_onChatStateChange);
    _tab.dispose();
    _inviteInputCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final chat = context.watch<ChatProvider>();

    return Scaffold(
      backgroundColor: const Color(0xFFFBF9F6),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: const Text(
          '둘만',
          style: TextStyle(
            color: Color(0xFFAE2F34),
            fontWeight: FontWeight.w800,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () async {
              await context.read<AuthProvider>().logout();
              if (!mounted) return;
              Navigator.of(context).pushReplacement(
                MaterialPageRoute(builder: (_) => const AuthScreen()),
              );
            },
            child: const Text('로그아웃', style: TextStyle(color: Colors.grey)),
          ),
        ],
      ),
      body: Column(
        children: [
          // 탭
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            decoration: BoxDecoration(
              color: const Color(0xFFEEEAE5),
              borderRadius: BorderRadius.circular(12),
            ),
            child: TabBar(
              controller: _tab,
              labelColor: Colors.white,
              unselectedLabelColor: Colors.grey,
              indicator: BoxDecoration(
                color: const Color(0xFFAE2F34),
                borderRadius: BorderRadius.circular(10),
              ),
              indicatorSize: TabBarIndicatorSize.tab,
              dividerColor: Colors.transparent,
              tabs: const [
                Tab(text: '초대코드 생성'),
                Tab(text: '코드 입력'),
              ],
            ),
          ),
          Expanded(
            child: TabBarView(
              controller: _tab,
              children: [
                _CreateTab(chat: chat, creating: _creating),
                _JoinTab(
                  ctrl: _inviteInputCtrl,
                  joining: _joining,
                  error: _joinError,
                  onJoin: _handleJoin,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─── 초대코드 생성 탭 ───────────────────────────────────────────────────────────

class _CreateTab extends StatelessWidget {
  final ChatProvider chat;
  final bool creating;

  const _CreateTab({required this.chat, required this.creating});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              color: const Color(0xFFFFEBEB),
              borderRadius: BorderRadius.circular(24),
            ),
            child: const Icon(
              Icons.favorite,
              color: Color(0xFFAE2F34),
              size: 44,
            ),
          ),
          const SizedBox(height: 20),
          const Text(
            '둘만의 안전한 공간을\n만듭니다.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 32),
          // 초대코드 박스
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: const Color(0xFFAE2F34).withOpacity(0.3),
                width: 1.5,
                style: BorderStyle.solid,
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.05),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Column(
              children: [
                const Text(
                  '초대 코드',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: Colors.grey,
                    letterSpacing: 1.5,
                  ),
                ),
                const SizedBox(height: 10),
                if (creating || chat.inviteCode == null)
                  const SizedBox(
                    height: 32,
                    child: CircularProgressIndicator(
                      color: Color(0xFFAE2F34),
                      strokeWidth: 2,
                    ),
                  )
                else
                  Text(
                    chat.inviteCode!,
                    style: const TextStyle(
                      fontFamily: 'monospace',
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 2,
                      color: Color(0xFF1A1A1A),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          // 복사 버튼
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton.icon(
              onPressed: chat.inviteCode == null
                  ? null
                  : () {
                      Clipboard.setData(ClipboardData(text: chat.inviteCode!));
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('초대코드가 복사되었습니다.')),
                      );
                    },
              icon: const Icon(Icons.copy, size: 18),
              label: const Text('코드 복사 및 공유'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFAE2F34),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
                elevation: 0,
              ),
            ),
          ),
          const SizedBox(height: 24),
          // 대기 상태 표시
          if (chat.state == ChatState.waiting)
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.grey,
                  ),
                ),
                const SizedBox(width: 8),
                const Text(
                  '상대방이 코드를 입력할 때까지 대기 중...',
                  style: TextStyle(color: Colors.grey, fontSize: 12),
                ),
              ],
            ),
        ],
      ),
    );
  }
}

// ─── 코드 입력 탭 ────────────────────────────────────────────────────────────────

class _JoinTab extends StatelessWidget {
  final TextEditingController ctrl;
  final bool joining;
  final String? error;
  final VoidCallback onJoin;

  const _JoinTab({
    required this.ctrl,
    required this.joining,
    required this.error,
    required this.onJoin,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          const SizedBox(height: 20),
          const Text(
            '파트너 연결하기',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          const Text(
            '상대방 기기에 표시된 초대코드를 입력하여\n안전하게 연결하세요.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.grey, fontSize: 13, height: 1.5),
          ),
          const SizedBox(height: 32),
          if (error != null)
            Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 16),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFFFFEBEB),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFFFCDD2)),
              ),
              child: Text(
                error!,
                style: const TextStyle(color: Color(0xFFB71C1C), fontSize: 13),
              ),
            ),
          TextField(
            controller: ctrl,
            textCapitalization: TextCapitalization.characters,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontFamily: 'monospace',
              fontSize: 18,
              fontWeight: FontWeight.w700,
              letterSpacing: 2,
            ),
            decoration: InputDecoration(
              hintText: '초대코드 입력',
              hintStyle: const TextStyle(
                letterSpacing: 0,
                fontWeight: FontWeight.w400,
                fontSize: 14,
              ),
              filled: true,
              fillColor: Colors.white,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: Color(0xFFE0E0E0)),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(
                  color: Color(0xFFAE2F34),
                  width: 1.5,
                ),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(
                  color: Color(0xFFAE2F34),
                  width: 2,
                ),
              ),
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 16,
                vertical: 18,
              ),
            ),
          ),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton.icon(
              onPressed: joining ? null : onJoin,
              icon: joining
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        color: Colors.white,
                        strokeWidth: 2,
                      ),
                    )
                  : const Icon(Icons.link, size: 20),
              label: Text(joining ? '연결 중...' : '연결하기'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFAE2F34),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
                elevation: 0,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
