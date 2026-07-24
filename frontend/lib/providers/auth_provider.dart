import 'package:flutter/foundation.dart';

import '../core/logger.dart';
import '../core/secure_storage.dart';
import '../core/supabase_client.dart';

enum AuthStatus { unknown, unauthenticated, authenticated }

class AuthProvider extends ChangeNotifier {
  AuthStatus _status = AuthStatus.unknown;
  String? _loginId;
  String? _deviceId;
  String? _error;

  AuthStatus get status => _status;
  String? get accessToken => supabaseClient.auth.currentSession?.accessToken;
  String? get loginId => _loginId;
  String? get deviceId => _deviceId;
  String? get error => _error;
  bool get isAuthenticated => _status == AuthStatus.authenticated;

  Future<int?> init() async {
    _deviceId = await SecureStorage.getOrCreateDeviceId();
    final session = supabaseClient.auth.currentSession;
    if (session == null) {
      _status = AuthStatus.unauthenticated;
      notifyListeners();
      return null;
    }

    try {
      _loginId = await _loadLoginId(session.user.id);
      if (_loginId == null) {
        await supabaseClient.auth.signOut();
        _status = AuthStatus.unauthenticated;
        notifyListeners();
        return null;
      }
      await _updateDeviceId(session.user.id);
      _status = AuthStatus.authenticated;
      notifyListeners();
      return null;
    } catch (e, st) {
      Log.e('AUTH', 'Supabase 세션 복구 실패', e, st);
      _status = AuthStatus.unauthenticated;
      notifyListeners();
      return null;
    }
  }

  Future<int?> login(String loginId, String password) async {
    _error = null;
    try {
      _validateLoginId(loginId);
      final response = await supabaseClient.auth.signInWithPassword(
        email: _authAlias(loginId),
        password: password,
      );
      final user = response.user;
      if (user == null) throw AuthException('AUTH_INVALID_CREDENTIALS');
      await _ensureAccount(user.id, loginId);
      await _updateDeviceId();
      _loginId = loginId;
      _status = AuthStatus.authenticated;
      notifyListeners();
      return null;
    } on AuthException catch (e) {
      _error = _translateAuthError(e.message);
      notifyListeners();
      return null;
    } on PostgrestException catch (e) {
      _error = _translateAuthError(e.message);
      notifyListeners();
      return null;
    } catch (e, st) {
      Log.e('AUTH', 'login 실패', e, st);
      _error = '로그인에 실패했습니다.';
      notifyListeners();
      return null;
    }
  }

  Future<int?> register(String loginId, String password) async {
    _error = null;
    try {
      _validateLoginId(loginId);
      final response = await supabaseClient.auth.signUp(
        email: _authAlias(loginId),
        password: password,
        data: {'login_id': loginId},
      );
      final user = response.user;
      if (user == null || response.session == null) {
        throw const AuthException('AUTH_CONFIRMATION_REQUIRED');
      }
      await _ensureAccount(user.id, loginId);
      await _updateDeviceId();
      _loginId = loginId;
      _status = AuthStatus.authenticated;
      notifyListeners();
      return null;
    } on AuthException catch (e) {
      _error = _translateAuthError(e.message);
      notifyListeners();
      return null;
    } on PostgrestException catch (e) {
      _error = _translateAuthError(e.message);
      notifyListeners();
      return null;
    } catch (e, st) {
      Log.e('AUTH', 'register 실패', e, st);
      _error = '회원가입에 실패했습니다.';
      notifyListeners();
      return null;
    }
  }

  Future<void> logout() async {
    await supabaseClient.auth.signOut();
    _loginId = null;
    _status = AuthStatus.unauthenticated;
    _error = null;
    notifyListeners();
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }

  Future<String?> _loadLoginId(String authUserId) async {
    final row = await supabaseClient
        .from('user_account')
        .select('login_id')
        .eq('auth_user_id', authUserId)
        .maybeSingle();
    return row?['login_id'] as String?;
  }

  Future<void> _ensureAccount(String authUserId, String loginId) async {
    // INSERT only — UPDATE is handled via update_device_id RPC (no direct UPDATE grant)
    await supabaseClient.from('user_account').upsert({
      'login_id': loginId,
      'auth_user_id': authUserId,
    }, onConflict: 'login_id', ignoreDuplicates: true);
  }

  Future<void> _updateDeviceId([String? _]) async {
    if (_deviceId == null) return;
    try {
      await supabaseClient.rpc('update_device_id', params: {'p_device_id': _deviceId});
    } catch (e) {
      // device_id 갱신 실패는 로그인을 차단하지 않음 (재시도는 다음 로그인 시)
      Log.w('AUTH', 'device_id 업데이트 실패 (비차단): $e');
    }
  }

  static String _authAlias(String loginId) => '$loginId@auth.dulman.invalid';

  static void _validateLoginId(String loginId) {
    if (!RegExp(r'^[A-Za-z0-9._-]{3,64}$').hasMatch(loginId)) {
      throw const AuthException('AUTH_INVALID_LOGIN_ID');
    }
  }

  String _translateAuthError(String message) {
    if (message.contains('already registered') || message.contains('duplicate')) {
      return '이미 사용 중인 아이디입니다.';
    }
    if (message.contains('Invalid login credentials')) {
      return '아이디 또는 비밀번호가 올바르지 않습니다.';
    }
    if (message == 'AUTH_CONFIRMATION_REQUIRED') {
      return '현재 Supabase 이메일 확인 설정이 켜져 있습니다. 운영 전 확인 설정을 변경해주세요.';
    }
    if (message == 'AUTH_INVALID_LOGIN_ID') {
      return '아이디는 영문, 숫자, ., _, -만 사용한 3~64자여야 합니다.';
    }
    return '인증에 실패했습니다.';
  }
}
