import 'package:flutter/foundation.dart';
import '../core/api_client.dart';
import '../core/logger.dart';
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
    Log.i('AUTH', 'init: deviceId=$_deviceId');
    final stored = await SecureStorage.loadAuth();
    final token = stored['access_token'];
    final loginId = stored['login_id'];
    final refreshToken = stored['refresh_token'];

    if (token == null || loginId == null) {
      Log.i('AUTH', 'init: 저장된 토큰 없음 → unauthenticated');
      _status = AuthStatus.unauthenticated;
      notifyListeners();
      return null;
    }

    Log.i('AUTH', 'init: 저장된 토큰 발견 loginId=$loginId');
    try {
      final result = await ApiClient.getActiveChat(token);
      _accessToken = token;
      _loginId = loginId;
      _status = AuthStatus.authenticated;
      final chatId = result['active_chat_id'] as int?;
      Log.i('AUTH', 'init: 토큰 유효 → authenticated  activeChatId=$chatId');
      notifyListeners();
      return chatId;
    } on ApiException catch (e) {
      Log.w('AUTH', 'init: 토큰 검증 실패 [${e.code}]');
      if (e.code == kErrSessionExpired && refreshToken != null) {
        Log.i('AUTH', 'init: 토큰 갱신 시도');
        return await _tryRefresh(loginId, refreshToken);
      }
      Log.w('AUTH', 'init: 토큰 폐기 → unauthenticated');
      await SecureStorage.clearAuth();
      _status = AuthStatus.unauthenticated;
      notifyListeners();
      return null;
    } catch (e, st) {
      Log.e('AUTH', 'init: 네트워크 오류 → 저장된 토큰 유지', e, st);
      _accessToken = token;
      _loginId = loginId;
      _status = AuthStatus.authenticated;
      notifyListeners();
      return null;
    }
  }

  Future<int?> _tryRefresh(String loginId, String refreshToken) async {
    Log.i('AUTH', '_tryRefresh: loginId=$loginId');
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
      Log.i('AUTH', '_tryRefresh 성공 → authenticated');
      final chatResult = await ApiClient.getActiveChat(newToken);
      return chatResult['active_chat_id'] as int?;
    } catch (e, st) {
      Log.e('AUTH', '_tryRefresh 실패 → unauthenticated', e, st);
      await SecureStorage.clearAuth();
      _status = AuthStatus.unauthenticated;
      notifyListeners();
      return null;
    }
  }

  Future<int?> login(String loginId, String password) async {
    _error = null;
    Log.i('AUTH', 'login: loginId=$loginId');
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
      final chatId = result['active_chat_id'] as int?;
      Log.i('AUTH', 'login 성공: loginId=$loginId  activeChatId=$chatId');
      return chatId;
    } on ApiException catch (e) {
      Log.e('AUTH', 'login 실패: [${e.code}] ${e.message}');
      _error = _translateError(e.code, e.message);
      notifyListeners();
      return null;
    }
  }

  Future<int?> register(String loginId, String password) async {
    _error = null;
    Log.i('AUTH', 'register: loginId=$loginId');
    try {
      await ApiClient.register(loginId, password);
      Log.i('AUTH', 'register 성공 → 자동 로그인');
      return await login(loginId, password);
    } on ApiException catch (e) {
      Log.e('AUTH', 'register 실패: [${e.code}] ${e.message}');
      _error = _translateError(e.code, e.message);
      notifyListeners();
      return null;
    }
  }

  Future<void> logout() async {
    Log.i('AUTH', 'logout: loginId=$_loginId');
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
