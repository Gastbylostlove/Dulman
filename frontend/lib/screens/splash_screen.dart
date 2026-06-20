import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/chat_provider.dart';
import 'auth_screen.dart';
import 'onboarding_screen.dart';
import 'chat_room_screen.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    final auth = context.read<AuthProvider>();
    final chat = context.read<ChatProvider>();

    final activeChatId = await auth.init();

    if (!mounted) return;

    if (!auth.isAuthenticated) {
      _go(const AuthScreen());
      return;
    }

    if (activeChatId != null) {
      await chat.loadActiveChat(knownChatId: activeChatId);
      if (!mounted) return;
      _go(const ChatRoomScreen());
    } else {
      _go(const OnboardingScreen());
    }
  }

  void _go(Widget screen) {
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => screen),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFAE2F34),
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
              ),
              child: const Icon(Icons.favorite, color: Color(0xFFAE2F34), size: 44),
            ),
            const SizedBox(height: 20),
            const Text(
              '시큐어커플',
              style: TextStyle(
                color: Colors.white,
                fontSize: 28,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.5,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'SecureCouple',
              style: TextStyle(color: Colors.white70, fontSize: 13, letterSpacing: 1),
            ),
            const SizedBox(height: 40),
            const CircularProgressIndicator(color: Colors.white54, strokeWidth: 2),
          ],
        ),
      ),
    );
  }
}
