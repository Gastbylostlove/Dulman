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

  static Future<void> saveAuth({
    required String accessToken,
    required String refreshToken,
    required String loginId,
  }) async {
    await Future.wait([
      _storage.write(key: kStorageKeyAccessToken, value: accessToken),
      _storage.write(key: kStorageKeyRefreshToken, value: refreshToken),
      _storage.write(key: kStorageKeyLoginId, value: loginId),
    ]);
  }

  static Future<Map<String, String?>> loadAuth() async {
    final results = await Future.wait([
      _storage.read(key: kStorageKeyAccessToken),
      _storage.read(key: kStorageKeyRefreshToken),
      _storage.read(key: kStorageKeyLoginId),
    ]);
    return {
      'access_token': results[0],
      'refresh_token': results[1],
      'login_id': results[2],
    };
  }

  static Future<void> clearAuth() async {
    await Future.wait([
      _storage.delete(key: kStorageKeyAccessToken),
      _storage.delete(key: kStorageKeyRefreshToken),
      _storage.delete(key: kStorageKeyLoginId),
    ]);
  }
}
