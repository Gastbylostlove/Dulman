import 'logger.dart';
import 'supabase_client.dart';

class ApiException implements Exception {
  final String code;
  final String message;

  ApiException(this.code, this.message);

  @override
  String toString() => '[$code] $message';
}

class ApiClient {
  static Future<Map<String, dynamic>> getActiveChat(String accessToken) async {
    final loginId = await _currentLoginId();
    try {
      final rows = await supabaseClient
          .from('chat')
          .select()
          .or('user_a_id.eq.$loginId,user_b_id.eq.$loginId')
          .inFilter('status', ['waiting', 'active'])
          .order('created_at', ascending: false)
          .limit(1);
      if (rows.isEmpty) return {'active_chat_id': null};
      return _chatResponse(rows.first);
    } on PostgrestException catch (e) {
      throw _mapException(e);
    }
  }

  static Future<Map<String, dynamic>> createChat(String accessToken) async {
    try {
      final row = await _rpcFirst('create_chat');
      return _chatResponse(row);
    } on PostgrestException catch (e) {
      throw _mapException(e);
    }
  }

  static Future<Map<String, dynamic>> joinChat(
    String accessToken,
    String inviteCode,
  ) async {
    try {
      final row = await _rpcFirst('join_chat', {'p_invite_code': inviteCode});
      return _chatResponse(row);
    } on PostgrestException catch (e) {
      throw _mapException(e);
    }
  }

  static Future<Map<String, dynamic>> listMessages(
    String accessToken,
    int chatId, {
    int? afterMessageId,
    int limit = 50,
  }) async {
    try {
      final chat = await supabaseClient
          .from('chat')
          .select('last_reset_at')
          .eq('id', chatId)
          .maybeSingle();
      if (chat == null) throw ApiException('CHAT_NOT_FOUND', '채팅방을 찾을 수 없습니다.');

      var query = supabaseClient
          .from('message')
          .select()
          .eq('chat_id', chatId);
      if (afterMessageId != null) query = query.gt('id', afterMessageId);
      final lastResetAt = chat['last_reset_at'] as String?;
      if (lastResetAt != null) query = query.gt('created_at', lastResetAt);
      final rows = await query.order('id', ascending: true).limit(limit.clamp(1, 100));

      final messages = <Map<String, dynamic>>[];
      final ids = <int>[];
      for (final item in rows) {
        final row = Map<String, dynamic>.from(item as Map);
        final id = row['id'] as int;
        ids.add(id);
        messages.add({...row, 'media': <Map<String, dynamic>>[]});
      }
      if (ids.isNotEmpty) {
        final mediaRows = await supabaseClient
            .from('media')
            .select()
            .inFilter('message_id', ids);
        final mediaByMessage = <int, List<Map<String, dynamic>>>{};
        for (final item in mediaRows) {
          final row = Map<String, dynamic>.from(item as Map);
          final messageId = row['message_id'] as int;
          (mediaByMessage[messageId] ??= []).add({
            'media_id': row['id'],
            'url': row['url'],
            'mime_type': row['mime_type'],
          });
        }
        for (final message in messages) {
          message['media'] = mediaByMessage[message['id']] ?? [];
        }
      }
      return {'messages': messages};
    } on ApiException {
      rethrow;
    } on PostgrestException catch (e) {
      throw _mapException(e);
    }
  }

  static Future<Map<String, dynamic>> sendText(
    String accessToken,
    int chatId,
    String textContent,
  ) async {
    try {
      return await _rpcFirst('send_text_message', {
        'p_chat_id': chatId,
        'p_text_content': textContent,
      });
    } on PostgrestException catch (e) {
      throw _mapException(e);
    }
  }

  static Future<Map<String, dynamic>> markChatRead(
    String accessToken,
    int chatId,
    int messageId,
  ) async {
    try {
      return await _rpcFirst('mark_chat_read', {
        'p_chat_id': chatId,
        'p_message_id': messageId,
      });
    } on PostgrestException catch (e) {
      throw _mapException(e);
    }
  }

  static Future<int> getPartnerLastReadMessageId(
    String accessToken,
    int chatId,
  ) async {
    try {
      final loginId = await _currentLoginId();
      final rows = await supabaseClient
          .from('chat_read_state')
          .select('last_read_message_id')
          .eq('chat_id', chatId)
          .neq('user_id', loginId)
          .order('last_read_message_id', ascending: false)
          .limit(1);
      if (rows.isEmpty) return 0;
      return rows.first['last_read_message_id'] as int? ?? 0;
    } on PostgrestException catch (e) {
      throw _mapException(e);
    }
  }

  static Future<Map<String, dynamic>> resetChat(
    String accessToken,
    int chatId,
  ) async {
    try {
      return await _rpcFirst('reset_chat', {'p_chat_id': chatId});
    } on PostgrestException catch (e) {
      throw _mapException(e);
    }
  }

  static Future<Map<String, dynamic>> leaveChat(
    String accessToken,
    int chatId,
  ) async {
    try {
      return await _rpcFirst('leave_chat', {'p_chat_id': chatId});
    } on PostgrestException catch (e) {
      throw _mapException(e);
    }
  }

  // Media remains unavailable until the signed-upload RPC and private bucket
  // are added. Keeping these methods preserves the existing UI boundary.
  static Future<Map<String, dynamic>> createMediaUploadIntent(
    String accessToken,
    int chatId,
    List<Map<String, dynamic>> files,
  ) async {
    throw ApiException('MEDIA_NOT_AVAILABLE', '미디어 업로드는 다음 단계에서 연결됩니다.');
  }

  static Future<void> uploadFile(
    String uploadPath,
    String filePath,
    String mimeType,
  ) async {
    throw ApiException('MEDIA_NOT_AVAILABLE', '미디어 업로드는 다음 단계에서 연결됩니다.');
  }

  static Future<Map<String, dynamic>> sendMediaMessage(
    String accessToken,
    int chatId,
    String permissionType,
    List<Map<String, String>> mediaItems, {
    String? textContent,
  }) async {
    throw ApiException('MEDIA_NOT_AVAILABLE', '미디어 업로드는 다음 단계에서 연결됩니다.');
  }

  static Future<Map<String, dynamic>> accessMedia(
    String accessToken,
    int messageId,
  ) async {
    throw ApiException('MEDIA_NOT_AVAILABLE', '미디어 열람은 다음 단계에서 연결됩니다.');
  }

  static Future<String> _currentLoginId() async {
    final user = supabaseClient.auth.currentUser;
    if (user == null) throw ApiException('AUTH_REQUIRED', '로그인이 필요합니다.');
    final row = await supabaseClient
        .from('user_account')
        .select('login_id')
        .eq('auth_user_id', user.id)
        .maybeSingle();
    final loginId = row?['login_id'] as String?;
    if (loginId == null) throw ApiException('AUTH_REQUIRED', '계정 정보를 찾을 수 없습니다.');
    return loginId;
  }

  static Future<Map<String, dynamic>> _rpcFirst(
    String function, [
    Map<String, dynamic> params = const {},
  ]) async {
    final result = await supabaseClient.rpc(function, params: params);
    if (result is List && result.isNotEmpty) {
      return Map<String, dynamic>.from(result.first as Map);
    }
    throw ApiException('EMPTY_RESULT', '서버 응답이 비어 있습니다.');
  }

  static Map<String, dynamic> _chatResponse(Map<String, dynamic> row) => {
        'chat_id': row['id'],
        'active_chat_id': row['id'],
        'status': row['status'],
        'user_a_id': row['user_a_id'],
        'user_b_id': row['user_b_id'],
        'invite_code': row['invite_code'],
        'last_reset_at': row['last_reset_at'],
      };

  static ApiException _mapException(PostgrestException error) {
    final message = error.message;
    final code = switch (true) {
      _ when message.contains('CHAT_ACTIVE_EXISTS') => 'CHAT_ACTIVE_EXISTS',
      _ when message.contains('CHAT_INVITE_NOT_FOUND') => 'CHAT_INVITE_NOT_FOUND',
      _ when message.contains('CHAT_INVITE_RATE_LIMITED') => 'CHAT_INVITE_RATE_LIMITED',
      _ when message.contains('CHAT_FULL') => 'CHAT_FULL',
      _ when message.contains('CHAT_NOT_ACTIVE') => 'CHAT_NOT_ACTIVE',
      _ when message.contains('CHAT_NOT_FOUND') => 'CHAT_NOT_FOUND',
      _ when message.contains('CHAT_PARTICIPANT_REQUIRED') => 'CHAT_PARTICIPANT_REQUIRED',
      _ when message.contains('MESSAGE_INVALID') => 'MESSAGE_INVALID',
      _ when message.contains('MESSAGE_NOT_FOUND') => 'MESSAGE_NOT_FOUND',
      _ when message.contains('RATE_LIMITED') => 'RATE_LIMITED',
      _ => error.code ?? 'SUPABASE_ERROR',
    };
    Log.w('SUPABASE', 'Error [$code]');
    return ApiException(code, _messageFor(code));
  }

  static String _messageFor(String code) => switch (code) {
        'CHAT_ACTIVE_EXISTS' => '이미 활성 채팅방이 있습니다.',
        'CHAT_INVITE_NOT_FOUND' => '초대코드를 찾을 수 없습니다.',
        'CHAT_INVITE_RATE_LIMITED' => '시도 횟수 초과. 5분 후 다시 시도해주세요.',
        'CHAT_FULL' => '이미 참여자가 있는 채팅방입니다.',
        'CHAT_NOT_ACTIVE' => '종료된 채팅방입니다.',
        'MESSAGE_INVALID' => '메시지를 확인해주세요.',
        'RATE_LIMITED' => '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
        _ => '요청을 처리하지 못했습니다.',
      };
}
