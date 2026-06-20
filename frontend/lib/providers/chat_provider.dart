import 'dart:async';
import 'package:flutter/foundation.dart';
import '../core/api_client.dart';
import '../core/constants.dart';
import '../models/models.dart';
import 'auth_provider.dart';

enum ChatState { idle, waiting, active, ended }

class ChatProvider extends ChangeNotifier {
  int? _chatId;
  String? _inviteCode;
  ChatState _state = ChatState.idle;
  List<Message> _messages = [];
  Timer? _pollTimer;
  String? _accessToken;
  String? _sendError;
  bool _isSending = false;

  // 상대방이 강제 로그아웃 처리됐는지 (AUTH_DEVICE_REPLACED)
  bool _forcedLogout = false;

  int? get chatId => _chatId;
  String? get inviteCode => _inviteCode;
  ChatState get state => _state;
  List<Message> get messages => _messages;
  String? get sendError => _sendError;
  bool get isSending => _isSending;
  bool get forcedLogout => _forcedLogout;

  void updateAuth(AuthProvider authProvider) {
    _accessToken = authProvider.accessToken;
  }

  // 채팅방 생성
  Future<bool> createChat() async {
    if (_accessToken == null) return false;
    try {
      final result = await ApiClient.createChat(_accessToken!);
      _chatId = result['chat_id'] as int;
      _inviteCode = result['invite_code'] as String;
      _state = ChatState.waiting;
      _startPollingForPartner();
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      if (e.code == kErrChatActiveExists) {
        // 이미 활성 채팅방이 있는 경우 → 해당 채팅방으로 이동
        await loadActiveChat();
        return true;
      }
      return false;
    }
  }

  // active 채팅방 불러오기 (앱 재진입 시)
  Future<void> loadActiveChat({int? knownChatId}) async {
    if (_accessToken == null) return;
    try {
      final result = await ApiClient.getActiveChat(_accessToken!);
      final id = knownChatId ?? result['active_chat_id'] as int?;
      if (id == null) {
        _state = ChatState.idle;
        notifyListeners();
        return;
      }
      _chatId = id;
      _inviteCode = null;
      final status = result['status'] as String? ?? 'active';
      _state = status == 'active' ? ChatState.active : ChatState.waiting;
      if (_state == ChatState.active) {
        await _loadMessages();
        _startPolling();
      } else {
        _startPollingForPartner();
      }
      notifyListeners();
    } on ApiException catch (e) {
      if (e.code == kErrDeviceReplaced) {
        _forcedLogout = true;
        notifyListeners();
      }
    }
  }

  // 초대코드로 입장
  Future<String?> joinChat(String inviteCode) async {
    if (_accessToken == null) return '인증 오류';
    try {
      final result = await ApiClient.joinChat(_accessToken!, inviteCode);
      _chatId = result['chat_id'] as int;
      _inviteCode = null;
      _state = ChatState.active;
      await _loadMessages();
      _startPolling();
      notifyListeners();
      return null; // 성공
    } on ApiException catch (e) {
      switch (e.code) {
        case 'CHAT_INVITE_NOT_FOUND': return '초대코드를 찾을 수 없습니다.';
        case 'CHAT_INVITE_RATE_LIMITED': return '시도 횟수 초과. 5분 후 다시 시도해주세요.';
        case kErrChatActiveExists: return '이미 활성 채팅방이 있습니다.';
        case 'CHAT_FULL': return '이미 참여자가 있는 채팅방입니다.';
        case 'CHAT_NOT_ACTIVE': return '종료된 채팅방입니다.';
        default: return e.message;
      }
    }
  }

  // 텍스트 전송
  Future<void> sendText(String text) async {
    if (_accessToken == null || _chatId == null || text.trim().isEmpty) return;
    _sendError = null;
    _isSending = true;
    notifyListeners();

    try {
      await ApiClient.sendText(_accessToken!, _chatId!, text.trim());
      await _loadMessages();
    } on ApiException catch (e) {
      if (e.code == kErrDeviceReplaced) {
        _forcedLogout = true;
      } else if (e.code == 'CHAT_NOT_ACTIVE') {
        _state = ChatState.ended;
      } else {
        _sendError = e.message;
      }
    } finally {
      _isSending = false;
      notifyListeners();
    }
  }

  // 채팅 리셋
  Future<String?> resetChat() async {
    if (_accessToken == null || _chatId == null) return '오류';
    try {
      await ApiClient.resetChat(_accessToken!, _chatId!);
      await _loadMessages();
      notifyListeners();
      return null;
    } on ApiException catch (e) {
      return e.message;
    }
  }

  // 채팅방 나가기
  Future<String?> leaveChat() async {
    if (_accessToken == null || _chatId == null) return '오류';
    try {
      await ApiClient.leaveChat(_accessToken!, _chatId!);
      _endChat();
      return null;
    } on ApiException catch (e) {
      return e.message;
    }
  }

  // 상대방이 나간 경우 등 상태 초기화
  void endChatLocally() => _endChat();

  Future<void> refreshMessages() async => _loadMessages();

  void clearForcedLogout() {
    _forcedLogout = false;
    notifyListeners();
  }

  void clearSendError() {
    _sendError = null;
    notifyListeners();
  }

  // ── 내부 ───────────────────────────────────────────────────────────────────

  Future<void> _loadMessages() async {
    if (_accessToken == null || _chatId == null) return;
    try {
      final result = await ApiClient.listMessages(_accessToken!, _chatId!);
      final list = (result['messages'] as List<dynamic>)
          .map((m) => Message.fromJson(m as Map<String, dynamic>))
          .toList();
      _messages = list;
    } on ApiException catch (e) {
      if (e.code == kErrDeviceReplaced) {
        _forcedLogout = true;
        notifyListeners();
      } else if (e.code == 'CHAT_NOT_ACTIVE') {
        _state = ChatState.ended;
        _stopPolling();
        notifyListeners();
      }
    }
  }

  // 파트너 참여 대기 폴링 (3초마다 chat status 확인)
  void _startPollingForPartner() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 3), (_) async {
      if (_accessToken == null) return;
      try {
        final result = await ApiClient.getActiveChat(_accessToken!);
        final status = result['status'] as String?;
        if (status == 'active') {
          _state = ChatState.active;
          _pollTimer?.cancel();
          await _loadMessages();
          _startPolling();
          notifyListeners();
        }
      } on ApiException catch (e) {
        if (e.code == kErrDeviceReplaced) {
          _forcedLogout = true;
          _pollTimer?.cancel();
          notifyListeners();
        }
      }
    });
  }

  // 메시지 폴링 (3초마다)
  void _startPolling() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 3), (_) async {
      await _loadMessages();
      notifyListeners();
    });
  }

  void _stopPolling() {
    _pollTimer?.cancel();
    _pollTimer = null;
  }

  void _endChat() {
    _stopPolling();
    _chatId = null;
    _inviteCode = null;
    _state = ChatState.idle;
    _messages = [];
    notifyListeners();
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }
}
