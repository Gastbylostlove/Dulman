import 'package:flutter/foundation.dart';
import '../core/api_client.dart';
import '../core/constants.dart';
import '../core/logger.dart';
import '../core/supabase_client.dart';
import '../data/local_database.dart';
import '../models/models.dart';
import 'auth_provider.dart';

enum ChatState { idle, waiting, active, ended }

class ChatProvider extends ChangeNotifier {
  ChatProvider(this._localDb);

  final LocalDatabase _localDb;

  int? _chatId;
  String? _inviteCode;
  ChatState _state = ChatState.idle;
  List<Message> _messages = [];
  RealtimeChannel? _realtimeChannel;
  int _partnerLastReadMessageId = 0;
  String? _accessToken;
  String? _loginId;
  String? _createError;
  String? _sendError;
  bool _isSending = false;

  // 상대방이 강제 로그아웃 처리됐는지 (AUTH_DEVICE_REPLACED)
  bool _forcedLogout = false;
  bool _hasOlderMessages = false;
  bool _isLoadingOlder = false;
  DateTime? _lastResetAt;
  int _cacheGeneration = 0;

  int? get chatId => _chatId;
  String? get inviteCode => _inviteCode;

  /// User-safe failure from the latest chat creation attempt.
  String? get createError => _createError;
  ChatState get state => _state;
  List<Message> get messages => _messages;
  String? get sendError => _sendError;
  bool get isSending => _isSending;
  bool get forcedLogout => _forcedLogout;
  bool get hasOlderMessages => _hasOlderMessages;
  bool get isLoadingOlder => _isLoadingOlder;

  bool isMessageRead(int messageId) => messageId <= _partnerLastReadMessageId;

  void updateAuth(AuthProvider authProvider) {
    _accessToken = authProvider.accessToken;
    _loginId = authProvider.loginId;
  }

  // 채팅방 생성
  Future<bool> createChat() async {
    _createError = null;
    if (_accessToken == null) {
      _chatId = null;
      _inviteCode = null;
      _state = ChatState.idle;
      _createError = '인증 오류';
      notifyListeners();
      return false;
    }
    Log.i('CHAT', 'createChat 시작');
    try {
      final result = await ApiClient.createChat(_accessToken!);
      _chatId = result['chat_id'] as int;
      _inviteCode = result['invite_code'] as String;
      _createError = null;
      _state = ChatState.waiting;
      Log.i('CHAT', '채팅방 생성됨: chatId=$_chatId');
      _subscribeToChat();
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      if (e.code == kErrChatActiveExists) {
        Log.w('CHAT', 'createChat: 이미 활성 채팅방 있음 → 기존 방 로드');
        await loadActiveChat();
        return true;
      }
      _createError = e.message;
      _chatId = null;
      _inviteCode = null;
      _state = ChatState.idle;
      Log.e('CHAT', 'createChat 실패: [${e.code}] ${e.message}');
      notifyListeners();
      return false;
    } catch (e, st) {
      _chatId = null;
      _inviteCode = null;
      _state = ChatState.idle;
      _createError = '초대코드 생성에 실패했습니다.';
      Log.e('CHAT', 'createChat 예기치 않은 실패', e, st);
      notifyListeners();
      return false;
    }
  }

  // active 채팅방 불러오기 (앱 재진입 시)
  Future<void> loadActiveChat({int? knownChatId}) async {
    if (_accessToken == null) return;
    Log.i('CHAT', 'loadActiveChat 시작');
    try {
      final result = await ApiClient.getActiveChat(_accessToken!);
      final id = knownChatId ?? result['active_chat_id'] as int?;
      if (id == null) {
        final wasActive = _chatId != null && _state == ChatState.active;
        Log.i('CHAT', 'loadActiveChat: 활성 채팅방 없음');
        if (wasActive) {
          _stopRealtime();
        }
        _chatId = null;
        _inviteCode = null;
        _createError = null;
        _state = wasActive ? ChatState.ended : ChatState.idle;
        notifyListeners();
        return;
      }
      _chatId = id;
      final status = result['status'] as String? ?? 'active';
      _lastResetAt = _parseTimestamp(result['last_reset_at']);
      _state = status == 'active' ? ChatState.active : ChatState.waiting;
      _inviteCode = _state == ChatState.waiting
          ? result['invite_code'] as String?
          : null;
      _createError = _state == ChatState.waiting && _inviteCode == null
          ? '초대코드를 불러오지 못했습니다.'
          : null;
      Log.i('CHAT', 'loadActiveChat: chatId=$_chatId  status=$status → state=$_state');
      if (_state == ChatState.active) {
        await _loadMessages(replace: true);
        await _loadPartnerReadState();
        _subscribeToChat();
      } else {
        _subscribeToChat();
      }
      notifyListeners();
    } on ApiException catch (e) {
      Log.e('CHAT', 'loadActiveChat 실패: [${e.code}] ${e.message}');
      if (e.code == kErrDeviceReplaced) {
        _forcedLogout = true;
        notifyListeners();
      }
    }
  }

  // 초대코드로 입장
  Future<String?> joinChat(String inviteCode) async {
    if (_accessToken == null) return '인증 오류';
    Log.i('CHAT', 'joinChat 시작');
    try {
      final result = await ApiClient.joinChat(_accessToken!, inviteCode);
      _chatId = result['chat_id'] as int;
      _inviteCode = null;
      _state = ChatState.active;
      Log.i('CHAT', 'joinChat 성공: chatId=$_chatId');
      await _loadMessages(replace: true);
      await _loadPartnerReadState();
      _subscribeToChat();
      notifyListeners();
      return null;
    } on ApiException catch (e) {
      Log.e('CHAT', 'joinChat 실패: [${e.code}] ${e.message}');
      switch (e.code) {
        case 'CHAT_INVITE_NOT_FOUND': return '초대코드를 찾을 수 없습니다.';
        case 'CHAT_INVITE_RATE_LIMITED': return '시도 횟수 초과. 5분 후 다시 시도해주세요.';
        case kErrChatActiveExists: return '이미 활성 채팅방이 있습니다.';
        case 'CHAT_SELF_JOIN': return '본인이 만든 초대코드입니다. 다른 계정으로 로그인해주세요.';
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
    Log.i('CHAT', 'sendText: ${text.length}자');

    try {
      await ApiClient.sendText(_accessToken!, _chatId!, text.trim());
      Log.i('CHAT', 'sendText 완료');
    } on ApiException catch (e) {
      Log.e('CHAT', 'sendText 실패: [${e.code}] ${e.message}');
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

  // 미디어 열람 (수신자만 view_count 차감 후 signed URL로 갱신)
  Future<({String? error, List<String> urls})> accessMedia(int messageId) async {
    if (_accessToken == null) {
      return (error: '인증 오류', urls: const <String>[]);
    }
    Log.i('CHAT', 'accessMedia: messageId=$messageId');
    try {
      final result = await ApiClient.accessMedia(_accessToken!, messageId);
      final signedUrls = (result['signed_urls'] as List<dynamic>).cast<String>();

      // 해당 메시지의 media URL을 signed URL로 교체
      final idx = _messages.indexWhere((m) => m.id == messageId);
      if (idx >= 0) {
        final msg = _messages[idx];
        if (signedUrls.length != msg.media.length) {
          throw ApiException('MEDIA_ACCESS_FAILED', '미디어 응답이 올바르지 않습니다.');
        }
        _messages = List<Message>.from(_messages)
          ..[idx] = msg.withAccessedMediaUrls(
            signedUrls,
            consumesView: msg.senderId != _loginId,
          );
        notifyListeners();
      }
      Log.i('CHAT', 'accessMedia 완료: messageId=$messageId  urls=${signedUrls.length}개');
      return (error: null, urls: signedUrls);
    } on ApiException catch (e) {
      Log.e('CHAT', 'accessMedia 실패: [${e.code}] ${e.message}');
      final message = e.code == 'MEDIA_VIEW_LIMIT_EXCEEDED'
          ? '열람 횟수를 초과했습니다.'
          : e.message;
      return (error: message, urls: const <String>[]);
    }
  }

  // 채팅 리셋
  Future<String?> resetChat() async {
    if (_accessToken == null || _chatId == null) return '오류';
    Log.i('CHAT', 'resetChat: chatId=$_chatId');
    try {
      final result = await ApiClient.resetChat(_accessToken!, _chatId!);
      _lastResetAt = _parseTimestamp(result['last_reset_at']);
      await _clearMessagesAfterReset(_chatId!);
      await _loadMessages(replace: true);
      notifyListeners();
      Log.i('CHAT', 'resetChat 완료');
      return null;
    } on ApiException catch (e) {
      Log.e('CHAT', 'resetChat 실패: [${e.code}] ${e.message}');
      return e.message;
    }
  }

  // 채팅방 나가기
  Future<String?> leaveChat() async {
    if (_accessToken == null || _chatId == null) return '오류';
    Log.i('CHAT', 'leaveChat: chatId=$_chatId');
    try {
      await ApiClient.leaveChat(_accessToken!, _chatId!);
      _endChat();
      Log.i('CHAT', 'leaveChat 완료');
      return null;
    } on ApiException catch (e) {
      Log.e('CHAT', 'leaveChat 실패: [${e.code}] ${e.message}');
      return e.message;
    }
  }

  // 상대방이 나간 경우 등 상태 초기화
  void endChatLocally() {
    Log.i('CHAT', 'endChatLocally 호출');
    _endChat();
  }

  Future<void> refreshMessages() async {
    await _loadMessages();
    notifyListeners();
  }

  Future<void> markRead() async {
    if (_accessToken == null || _chatId == null || _messages.isEmpty) return;
    try {
      await ApiClient.markChatRead(_accessToken!, _chatId!, _messages.last.id);
    } on ApiException catch (e) {
      Log.w('CHAT', '읽음 상태 반영 실패: [${e.code}]');
    }
  }

  Future<void> _loadPartnerReadState() async {
    if (_accessToken == null || _chatId == null) return;
    try {
      _partnerLastReadMessageId = await ApiClient.getPartnerLastReadMessageId(
        _accessToken!,
        _chatId!,
      );
    } on ApiException catch (e) {
      Log.w('CHAT', '상대방 읽음 상태 조회 실패: [${e.code}]');
    }
  }

  void clearForcedLogout() {
    _forcedLogout = false;
    notifyListeners();
  }

  void clearSendError() {
    _sendError = null;
    notifyListeners();
  }

  // ── 내부 ───────────────────────────────────────────────────────────────────

  // 이전 메시지 더 불러오기 (위로 스크롤 시 호출)
  Future<void> loadOlderMessages() async {
    if (_accessToken == null || _chatId == null) return;
    if (!_hasOlderMessages || _isLoadingOlder || _messages.isEmpty) return;
    final generation = _cacheGeneration;
    final chatId = _chatId!;
    _isLoadingOlder = true;
    notifyListeners();
    try {
      final result = await ApiClient.listMessages(
        _accessToken!,
        chatId,
        beforeMessageId: _messages.first.id,
        descending: true,
      );
      if (generation != _cacheGeneration || chatId != _chatId) return;
      final list = (result['messages'] as List<dynamic>)
          .map((m) => Message.fromJson(m as Map<String, dynamic>))
          .toList()
          .reversed
          .toList();
      _hasOlderMessages = list.length >= 50;
      if (list.isNotEmpty) {
        final byId = {for (final m in list) m.id: m};
        for (final m in _messages) { byId[m.id] = m; }
        _messages = byId.values.toList()..sort((a, b) => a.id.compareTo(b.id));
        Log.i('CHAT', 'loadOlderMessages: ${list.length}개 선행 추가');
      }
    } on ApiException catch (e) {
      Log.e('CHAT', 'loadOlderMessages 실패: [${e.code}] ${e.message}');
    } finally {
      _isLoadingOlder = false;
      notifyListeners();
    }
  }

  Future<void> _loadMessages({bool replace = false}) async {
    if (_accessToken == null || _chatId == null) return;
    final generation = _cacheGeneration;
    final chatId = _chatId!;
    try {
      // 초기 로드는 최신 메시지부터 (DESC), 이후 증분 로드는 ASC
      final isInitial = replace || _messages.isEmpty;
      final result = await ApiClient.listMessages(
        _accessToken!,
        chatId,
        afterMessageId: isInitial ? null : _messages.last.id,
        descending: isInitial,
      );
      if (generation != _cacheGeneration || chatId != _chatId) return;
      var list = (result['messages'] as List<dynamic>)
          .map((m) => Message.fromJson(m as Map<String, dynamic>))
          .toList();
      if (isInitial) {
        // DESC로 받았으므로 역전해서 시간 오름차순으로 표시
        list = list.reversed.toList();
        _hasOlderMessages = list.length >= 50;
        _messages = list;
      } else if (list.isNotEmpty) {
        final byId = {for (final message in _messages) message.id: message};
        for (final message in list) {
          byId[message.id] = message;
        }
        _messages = byId.values.toList()..sort((a, b) => a.id.compareTo(b.id));
      }
      if (list.isNotEmpty) {
        Log.i('CHAT', '_loadMessages: ${list.length}개 추가/갱신');
        await _cacheMessages(list);
      }
    } on ApiException catch (e) {
      Log.e('CHAT', '_loadMessages 실패: [${e.code}] ${e.message}');
      if (e.code == kErrDeviceReplaced) {
        _forcedLogout = true;
        notifyListeners();
      } else if (e.code == 'CHAT_NOT_ACTIVE') {
        _state = ChatState.ended;
        _stopRealtime();
        notifyListeners();
      }
    }
  }

  Future<void> _cacheMessages(List<Message> messages) async {
    final chatId = _chatId;
    if (chatId == null) return;
    final generation = _cacheGeneration;
    for (final msg in messages) {
      if (generation != _cacheGeneration) return;
      try {
        await _localDb.cacheMessage(
          id: msg.id,
          chatId: chatId,
          senderId: msg.senderId,
          type: msg.type,
          textContent: msg.textContent,
          createdAt: msg.createdAt.toIso8601String(),
        );
      } catch (e) {
        Log.w('CHAT', '캐시 저장 실패: $e');
      }
    }
  }

  /// 진행 중인 캐시 쓰기를 무효화하고 reset된 채팅 캐시를 비운다.
  Future<void> _clearMessagesAfterReset(int chatId) async {
    _cacheGeneration++;
    _messages = [];
    _hasOlderMessages = false;
    await _localDb.clearChatMessages(chatId);
  }

  void _subscribeToChat() {
    _stopRealtime();
    final chatId = _chatId;
    if (chatId == null) return;

    final channel = supabaseClient.channel(
      'private-chat:$chatId',
      opts: const RealtimeChannelConfig(private: true),
    );
    channel.onPostgresChanges(
      event: PostgresChangeEvent.insert,
      schema: 'public',
      table: 'message',
      filter: PostgresChangeFilter(
        type: PostgresChangeFilterType.eq,
        column: 'chat_id',
        value: chatId,
      ),
      callback: (payload) async {
        final record = payload.newRecord;
        // 텍스트 메시지는 payload로 즉시 추가, 미디어는 full reload
        if (record.isNotEmpty && record['type'] == 'text') {
          final msg = Message.fromJson({...record, 'media': <dynamic>[]});
          final byId = {for (final m in _messages) m.id: m};
          byId[msg.id] = msg;
          _messages = byId.values.toList()..sort((a, b) => a.id.compareTo(b.id));
          await _cacheMessages([msg]);
          notifyListeners();
        } else {
          await _loadMessages();
          notifyListeners();
        }
      },
    );
    channel.onPostgresChanges(
      event: PostgresChangeEvent.update,
      schema: 'public',
      table: 'chat',
      filter: PostgresChangeFilter(
        type: PostgresChangeFilterType.eq,
        column: 'id',
        value: chatId,
      ),
      callback: (payload) async {
        final status = payload.newRecord['status'] as String?;
        final resetAt = _parseTimestamp(payload.newRecord['last_reset_at']);
        final resetChanged = resetAt != null && resetAt != _lastResetAt;
        if (status == 'active' && _state != ChatState.active) {
          _state = ChatState.active;
          _messages = [];
          _lastResetAt = resetAt;
          await _loadMessages(replace: true);
        } else if (status == 'active' && resetChanged) {
          _lastResetAt = resetAt;
          await _clearMessagesAfterReset(chatId);
          await _loadMessages(replace: true);
        } else if (status == 'ended') {
          _state = ChatState.ended;
        }
        notifyListeners();
      },
    );
    channel.onPostgresChanges(
      event: PostgresChangeEvent.all,
      schema: 'public',
      table: 'chat_read_state',
      filter: PostgresChangeFilter(
        type: PostgresChangeFilterType.eq,
        column: 'chat_id',
        value: chatId,
      ),
      callback: (_) async {
        await _loadPartnerReadState();
        notifyListeners();
      },
    );
    _realtimeChannel = channel..subscribe();
    Log.i('CHAT', 'Realtime 구독 시작: chatId=$chatId');
  }

  void _stopRealtime() {
    final channel = _realtimeChannel;
    if (channel != null) {
      supabaseClient.removeChannel(channel);
      _realtimeChannel = null;
    }
  }

  void _endChat() {
    _stopRealtime();
    Log.i('CHAT', '채팅 종료: chatId=$_chatId → idle');
    _chatId = null;
    _inviteCode = null;
    _state = ChatState.idle;
    _messages = [];
    _lastResetAt = null;
    notifyListeners();
  }

  /// Supabase timestamptz 값을 비교 가능한 DateTime으로 변환한다.
  static DateTime? _parseTimestamp(Object? value) {
    return value is String ? DateTime.tryParse(value) : null;
  }

  @override
  void dispose() {
    _stopRealtime();
    super.dispose();
  }
}
