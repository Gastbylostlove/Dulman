import 'dart:math';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'constants.dart';

class SecureStorage {
  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  static Future<String> getOrCreateDeviceId() async {
    final existing = await _storage.read(key: kStorageKeyDeviceId);
    if (existing != null && existing.isNotEmpty) return existing;
    final id = _generateDeviceId();
    await _storage.write(key: kStorageKeyDeviceId, value: id);
    return id;
  }

  static String _generateDeviceId() {
    final rand = Random.secure();
    final bytes = List<int>.generate(16, (_) => rand.nextInt(256));
    return 'android-${bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join()}';
  }
}
