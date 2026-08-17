import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'core/supabase_config.dart';
import 'data/local_database.dart';
import 'providers/auth_provider.dart';
import 'providers/chat_provider.dart';
import 'screens/splash_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  await initializeSupabase();
  final localDatabase = await LocalDatabase.open();
  runApp(DulmanApp(localDatabase: localDatabase));
}

class DulmanApp extends StatelessWidget {
  const DulmanApp({super.key, required this.localDatabase});

  final LocalDatabase localDatabase;

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider<LocalDatabase>.value(value: localDatabase),
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProxyProvider<AuthProvider, ChatProvider>(
          create: (ctx) => ChatProvider(ctx.read<LocalDatabase>()),
          update: (_, auth, chat) {
            chat!.updateAuth(auth);
            return chat;
          },
        ),
      ],
      child: MaterialApp(
        title: '둘만',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(
            seedColor: const Color(0xFFFF5E00),
            brightness: Brightness.dark,
          ),
          scaffoldBackgroundColor: const Color(0xFF161124),
          textTheme: GoogleFonts.notoSansKrTextTheme(
            ThemeData(brightness: Brightness.dark).textTheme,
          ),
          useMaterial3: true,
          appBarTheme: const AppBarTheme(
            systemOverlayStyle: SystemUiOverlayStyle(
              statusBarBrightness: Brightness.dark,
              statusBarIconBrightness: Brightness.light,
            ),
          ),
        ),
        home: const SplashScreen(),
      ),
    );
  }
}
