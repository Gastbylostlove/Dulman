import 'package:flutter/foundation.dart';
import '../core/api_client.dart';
import '../core/secure_storage.dart';
import '../core/constants.dart';

enum AuthStatus { unknown, unauthenticated, authenticated }

class AuthProvider extends ChangeNotifier {
  AuthStatus _status = AuthStatus.unknown;
  String? _accessToken;
  String? _loginId;
  String? _deviceId;
  String? _error;

  AuthStatus get status => _status;
  String? get accessToken => _accessToken;
  String? get loginId => _loginId;
  String? get deviceId => _deviceId;
  String? get error => _error;
  bool get isAuthenticated => _status == AuthStatus.authenticated;

  Future<int?> init() async {
    _deviceId = await SecureStorage.getOrCreateDeviceId();
    final stored = await SecureStorage.loadAuth();
    final token = stored['access_token'];
    final loginId = stored['login_id'];
    final refreshToken = stored['refresh_token'];

    if (token == null || loginId == null) {
      _status = AuthStatus.unauthenticated;
      notifyListeners();
      return null;
    }

    try {
      final result = await ApiClient.getActiveChat(token);
      _accessToken = token;
      _loginId = loginId;
      _status = AuthStatus.authenticated;
      notifyListeners();
      return result['active_chat_id'] as int?;
    } on ApiException catch (e) {
      if (e.code == kErrSessionExpired && refreshToken != null) {
        return await _tryRefresh(loginId, refreshToken);
      }
      await SecureStorage.clearAuth();
      _status = AuthStatus.unauthenticated;
      notifyListeners();
      return null;
    } catch (_) {
      // 네트워크 오류 시 저장된 토큰 그대로 사용
      _accessToken = token;
      _loginId = loginId;
      _status = AuthStatus.authenticated;
      notifyListeners();
      return null;
    }
  }

  Future<int?> _tryRefresh(String loginId, String refreshToken) async {
    try {
      final result = await ApiClient.refreshTokens(loginId, refreshToken, _deviceId!);
      final newToken = result['access_token'] as String;
      await SecureStorage.saveAuth(
        accessToken: newToken,
        refreshToken: refreshToken,
        loginId: loginId,
      );
      _accessToken = newToken;
      _loginId = loginId;
      _status = AuthStatus.authenticated;
      notifyListeners();
      final chatResult = await ApiClient.getActiveChat(newToken);
      return chatResult['active_chat_id'] as int?;
    } catch (_) {
      await SecureStorage.clearAuth();
      _status = AuthStatus.unauthenticated;
      notifyListeners();
      return null;
    }
  }

  Future<int?> login(String loginId, String password) async {
    _error = null;
    try {
      final result = await ApiClient.login(loginId, password, _deviceId!);
      final accessToken = result['access_token'] as String;
      final refreshToken = result['refresh_token'] as String;
      await SecureStorage.saveAuth(
        accessToken: accessToken,
        refreshToken: refreshToken,
        loginId: loginId,
      );
      _accessToken = accessToken;
      _loginId = loginId;
      _status = AuthStatus.authenticated;
      notifyListeners();
      return result['active_chat_id'] as int?;
    } on ApiException catch (e) {
      _error = _translateError(e.code, e.message);
      notifyListeners();
      return null;
    }
  }

  Future<int?> register(String loginId, String password) async {
    _error = null;
    try {
      await ApiClient.register(loginId, password);
      return await login(loginId, password);
    } on ApiException catch (e) {
      _error = _translateError(e.code, e.message);
      notifyListeners();
      return null;
    }
  }

  Future<void> logout() async {
    await SecureStorage.clearAuth();
    _accessToken = null;
    _loginId = null;
    _status = AuthStatus.unauthenticated;
    _error = null;
    notifyListeners();
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }

  String _translateError(String code, String fallback) {
    switch (code) {
      case 'AUTH_LOGIN_ID_DUPLICATED': return '이미 사용 중인 아이디입니다.';
      case 'AUTH_INVALID_CREDENTIALS': return '아이디 또는 비밀번호가 올바르지 않습니다.';
      case 'AUTH_RATE_LIMITED': return '로그인 시도가 너무 많습니다. 5분 후 다시 시도해주세요.';
      default: return fallback;
    }
  }
}
