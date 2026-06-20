import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/chat_provider.dart';
import 'onboarding_screen.dart';
import 'chat_room_screen.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tab;

  // 로그인 폼
  final _loginIdCtrl = TextEditingController();
  final _loginPwCtrl = TextEditingController();

  // 회원가입 폼
  final _signupIdCtrl = TextEditingController();
  final _signupPwCtrl = TextEditingController();
  final _signupPwConfirm = TextEditingController();

  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tab.dispose();
    _loginIdCtrl.dispose();
    _loginPwCtrl.dispose();
    _signupIdCtrl.dispose();
    _signupPwCtrl.dispose();
    _signupPwConfirm.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    final id = _loginIdCtrl.text.trim();
    final pw = _loginPwCtrl.text;
    if (id.isEmpty || pw.isEmpty) {
      setState(() => _error = '아이디와 비밀번호를 입력해주세요.');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    final auth = context.read<AuthProvider>();
    final activeChatId = await auth.login(id, pw);
    if (!mounted) return;
    setState(() => _loading = false);

    if (auth.error != null) {
      setState(() => _error = auth.error);
      return;
    }
    _navigateAfterAuth(activeChatId);
  }

  Future<void> _handleSignup() async {
    final id = _signupIdCtrl.text.trim();
    final pw = _signupPwCtrl.text;
    final pw2 = _signupPwConfirm.text;
    if (id.isEmpty || pw.isEmpty) {
      setState(() => _error = '아이디와 비밀번호를 입력해주세요.');
      return;
    }
    if (pw != pw2) {
      setState(() => _error = '비밀번호가 일치하지 않습니다.');
      return;
    }
    if (pw.length < 6) {
      setState(() => _error = '비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    final auth = context.read<AuthProvider>();
    final activeChatId = await auth.register(id, pw);
    if (!mounted) return;
    setState(() => _loading = false);

    if (auth.error != null) {
      setState(() => _error = auth.error);
      return;
    }
    _navigateAfterAuth(activeChatId);
  }

  void _navigateAfterAuth(int? activeChatId) async {
    final auth = context.read<AuthProvider>();
    final chat = context.read<ChatProvider>();
    chat.updateAuth(auth);
    if (activeChatId != null) {
      await chat.loadActiveChat(knownChatId: activeChatId);
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const ChatRoomScreen()),
      );
    } else {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const OnboardingScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFBF9F6),
      body: SafeArea(
        child: Column(
          children: [
            const SizedBox(height: 40),
            // 로고
            const Icon(Icons.favorite, color: Color(0xFFAE2F34), size: 48),
            const SizedBox(height: 12),
            const Text(
              '둘만',
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w800,
                color: Color(0xFF1A1A1A),
                letterSpacing: -0.5,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              '둘만의 안전한 공간',
              style: TextStyle(fontSize: 13, color: Colors.grey),
            ),
            const SizedBox(height: 32),
            // 탭
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 24),
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
                  Tab(text: '로그인'),
                  Tab(text: '회원가입'),
                ],
                onTap: (_) => setState(() => _error = null),
              ),
            ),
            const SizedBox(height: 24),
            // 에러 메시지
            if (_error != null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 10,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFEBEB),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFFFFCDD2)),
                  ),
                  child: Text(
                    _error!,
                    style: const TextStyle(
                      color: Color(0xFFB71C1C),
                      fontSize: 13,
                    ),
                  ),
                ),
              ),
            if (_error != null) const SizedBox(height: 12),
            // 폼 영역
            Expanded(
              child: TabBarView(
                controller: _tab,
                children: [
                  _LoginForm(
                    idCtrl: _loginIdCtrl,
                    pwCtrl: _loginPwCtrl,
                    loading: _loading,
                    onSubmit: _handleLogin,
                  ),
                  _SignupForm(
                    idCtrl: _signupIdCtrl,
                    pwCtrl: _signupPwCtrl,
                    pwConfirmCtrl: _signupPwConfirm,
                    loading: _loading,
                    onSubmit: _handleSignup,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LoginForm extends StatelessWidget {
  final TextEditingController idCtrl;
  final TextEditingController pwCtrl;
  final bool loading;
  final VoidCallback onSubmit;

  const _LoginForm({
    required this.idCtrl,
    required this.pwCtrl,
    required this.loading,
    required this.onSubmit,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        children: [
          _Field(controller: idCtrl, label: '아이디', hint: 'example_id'),
          const SizedBox(height: 14),
          _Field(
            controller: pwCtrl,
            label: '비밀번호',
            hint: '••••••••',
            obscure: true,
          ),
          const SizedBox(height: 24),
          _SubmitButton(loading: loading, label: '로그인', onTap: onSubmit),
        ],
      ),
    );
  }
}

class _SignupForm extends StatelessWidget {
  final TextEditingController idCtrl;
  final TextEditingController pwCtrl;
  final TextEditingController pwConfirmCtrl;
  final bool loading;
  final VoidCallback onSubmit;

  const _SignupForm({
    required this.idCtrl,
    required this.pwCtrl,
    required this.pwConfirmCtrl,
    required this.loading,
    required this.onSubmit,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        children: [
          _Field(controller: idCtrl, label: '아이디', hint: 'example_id'),
          const SizedBox(height: 14),
          _Field(
            controller: pwCtrl,
            label: '비밀번호',
            hint: '6자 이상',
            obscure: true,
          ),
          const SizedBox(height: 14),
          _Field(
            controller: pwConfirmCtrl,
            label: '비밀번호 확인',
            hint: '••••••••',
            obscure: true,
          ),
          const SizedBox(height: 24),
          _SubmitButton(loading: loading, label: '회원가입', onTap: onSubmit),
        ],
      ),
    );
  }
}

class _Field extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final String hint;
  final bool obscure;

  const _Field({
    required this.controller,
    required this.label,
    required this.hint,
    this.obscure = false,
  });

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      obscureText: obscure,
      style: const TextStyle(fontSize: 15),
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFE0E0E0)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFE0E0E0)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFAE2F34), width: 1.5),
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 14,
        ),
      ),
    );
  }
}

class _SubmitButton extends StatelessWidget {
  final bool loading;
  final String label;
  final VoidCallback onTap;

  const _SubmitButton({
    required this.loading,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 52,
      child: ElevatedButton(
        onPressed: loading ? null : onTap,
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFFAE2F34),
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          elevation: 0,
        ),
        child: loading
            ? const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(
                  color: Colors.white,
                  strokeWidth: 2,
                ),
              )
            : Text(
                label,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
      ),
    );
  }
}
