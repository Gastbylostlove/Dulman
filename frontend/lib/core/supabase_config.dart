import 'package:supabase_flutter/supabase_flutter.dart';

const String kSupabaseUrl = String.fromEnvironment(
  'DULMAN_SUPABASE_URL',
  defaultValue: 'https://kfcfbqmriqcqyriisnof.supabase.co',
);

// This is a publishable key. Never place a service-role key in the app.
const String kSupabasePublishableKey = String.fromEnvironment(
  'DULMAN_SUPABASE_PUBLISHABLE_KEY',
  defaultValue: 'sb_publishable_4PhBCHqwd8phAqe3Uv5Blw_wIzonuRn',
);

Future<void> initializeSupabase() async {
  await Supabase.initialize(
    url: kSupabaseUrl,
    publishableKey: kSupabasePublishableKey,
  );
}
