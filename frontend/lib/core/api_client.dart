import 'dart:io';
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
    int? beforeMessageId,
    int limit = 50,
    bool descending = false,
  }) async {
    try {
      // 참여자 여부만 확인 (last_reset_at 필터는 RLS에서 처리)
      final chatExists = await supabaseClient
          .from('chat')
          .select('id')
          .eq('id', chatId)
          .maybeSingle();
      if (chatExists == null) throw ApiException('CHAT_NOT_FOUND', '채팅방을 찾을 수 없습니다.');

      var query = supabaseClient
          .from('message')
          .select()
          .eq('chat_id', chatId);
      if (afterMessageId != null) query = query.gt('id', afterMessageId);
      if (beforeMessageId != null) query = query.lt('id', beforeMessageId);
      // last_reset_at 필터는 RLS(message_select_participant)가 서버에서 처리
      final rows = await query
          .order('id', ascending: !descending)
          .limit(limit.clamp(1, 100));

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
        // permissionType lookup for signed URL decision
        final permByMessage = <int, String?>{
          for (final m in messages)
            m['id'] as int: m['permission_type'] as String?,
        };
        // 1단계: 행을 messageId별로 분류 (서명 전)
        final rawByMessage = <int, List<Map<String, dynamic>>>{};
        for (final item in mediaRows) {
          final row = Map<String, dynamic>.from(item as Map);
          final messageId = row['message_id'] as int;
          (rawByMessage[messageId] ??= []).add(row);
        }

        // 2단계: keep 타입만 signed URL 병렬 발급
        final mediaByMessage = <int, List<Map<String, dynamic>>>{};
        await Future.wait(rawByMessage.entries.map((entry) async {
          final messageId = entry.key;
          final rows = entry.value;
          final isKeep = permByMessage[messageId] == 'keep';
          final List<String> urls;
          if (isKeep) {
            urls = await Future.wait(rows.map((row) async {
              final path = row['url'] as String;
              if (path.startsWith('http')) return path;
              try {
                return await supabaseClient.storage.from('media').createSignedUrl(path, 3600);
              } catch (e) {
                Log.w('API', 'keep 미디어 signed URL 생성 실패 (path=$path): $e');
                return path;
              }
            }));
          } else {
            urls = rows.map((row) => row['url'] as String).toList();
          }
          mediaByMessage[messageId] = [
            for (var i = 0; i < rows.length; i++)
              {
                'media_id': rows[i]['id'],
                'url': urls[i],
                'mime_type': rows[i]['mime_type'],
              },
          ];
        }));
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

  // 서버 검증 후 1분짜리 signed upload token 발급
  static Future<Map<String, dynamic>> createMediaUploadIntent(
    String accessToken,
    int chatId,
    List<Map<String, dynamic>> files,
  ) async {
    try {
      final result = await supabaseClient.functions.invoke(
        'create-media-upload',
        body: {'chat_id': chatId, 'files': files},
      );
      return Map<String, dynamic>.from(result.data as Map);
    } on FunctionException catch (e) {
      throw _mapFunctionException(e, fallbackCode: 'MEDIA_UPLOAD_FAILED');
    } catch (e) {
      throw ApiException('MEDIA_UPLOAD_FAILED', '업로드 권한 발급 실패: $e');
    }
  }

  // 서버가 발급한 일회용 token으로 Supabase Storage 업로드
  static Future<void> uploadFile(
    String storagePath,
    String uploadToken,
    String filePath,
    String mimeType,
  ) async {
    try {
      final bytes = await File(filePath).readAsBytes();
      await supabaseClient.storage
          .from('media')
          .uploadBinaryToSignedUrl(
            storagePath,
            uploadToken,
            bytes,
            FileOptions(contentType: mimeType),
          );
    } catch (e) {
      throw ApiException('MEDIA_UPLOAD_FAILED', '파일 업로드 실패: $e');
    }
  }

  static Future<Map<String, dynamic>> sendMediaMessage(
    String accessToken,
    int chatId,
    String permissionType,
    List<Map<String, String>> mediaItems, {
    String? textContent,
  }) async {
    try {
      final p = <Map<String, String>>[];
      for (final item in mediaItems) {
        p.add({'storage_path': item['url']!, 'mime_type': item['mime_type']!});
      }
      return await _rpcFirst('send_media_message', {
        'p_chat_id': chatId,
        'p_permission_type': permissionType,
        'p_media_items': p,
        'p_text_content': textContent,
      });
    } on PostgrestException catch (e) {
      throw _mapException(e);
    }
  }

  // Edge Function에서 view_count 차감과 signed URL 발급을 처리
  static Future<Map<String, dynamic>> accessMedia(
    String accessToken,
    int messageId,
  ) async {
    try {
      final result = await supabaseClient.functions.invoke(
        'access-media',
        body: {'message_id': messageId},
      );
      return Map<String, dynamic>.from(result.data as Map);
    } on FunctionException catch (e) {
      throw _mapFunctionException(e, fallbackCode: 'MEDIA_ACCESS_FAILED');
    } catch (e) {
      throw ApiException('MEDIA_ACCESS_FAILED', '미디어 열람 실패: $e');
    }
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
      _ when message.contains('CHAT_SELF_JOIN') => 'CHAT_SELF_JOIN',
      _ when message.contains('CHAT_FULL') => 'CHAT_FULL',
      _ when message.contains('CHAT_NOT_ACTIVE') => 'CHAT_NOT_ACTIVE',
      _ when message.contains('CHAT_NOT_FOUND') => 'CHAT_NOT_FOUND',
      _ when message.contains('CHAT_PARTICIPANT_REQUIRED') => 'CHAT_PARTICIPANT_REQUIRED',
      _ when message.contains('AUTH_REQUIRED') => 'AUTH_REQUIRED',
      _ when message.contains('AUTH_SESSION_EXPIRED') => 'AUTH_SESSION_EXPIRED',
      _ when message.contains('AUTH_DEVICE_REPLACED') => 'AUTH_DEVICE_REPLACED',
      _ when message.contains('MEDIA_VIEW_LIMIT_EXCEEDED') => 'MEDIA_VIEW_LIMIT_EXCEEDED',
      _ when message.contains('MESSAGE_INVALID') => 'MESSAGE_INVALID',
      _ when message.contains('MESSAGE_NOT_FOUND') => 'MESSAGE_NOT_FOUND',
      _ when message.contains('RATE_LIMITED') => 'RATE_LIMITED',
      _ => error.code ?? 'SUPABASE_ERROR',
    };
    Log.w(
      'SUPABASE',
      'Error [$code] ${error.message} details=${error.details} hint=${error.hint}',
    );
    return ApiException(code, _messageFor(code));
  }

  static String _messageFor(String code) => switch (code) {
        'CHAT_ACTIVE_EXISTS' => '이미 활성 채팅방이 있습니다.',
        'CHAT_INVITE_NOT_FOUND' => '초대코드를 찾을 수 없습니다.',
        'CHAT_INVITE_RATE_LIMITED' => '시도 횟수 초과. 5분 후 다시 시도해주세요.',
        'CHAT_SELF_JOIN' => '본인이 만든 초대코드입니다. 다른 계정으로 로그인해주세요.',
        'CHAT_FULL' => '이미 참여자가 있는 채팅방입니다.',
        'CHAT_NOT_ACTIVE' => '종료된 채팅방입니다.',
        'AUTH_REQUIRED' || 'AUTH_SESSION_EXPIRED' => '로그인 세션이 만료되었습니다. 다시 로그인해주세요.',
        'AUTH_DEVICE_REPLACED' => '다른 기기에서 로그인되어 현재 세션이 종료되었습니다.',
        'MEDIA_VIEW_LIMIT_EXCEEDED' => '열람 횟수를 초과했습니다.',
        'MEDIA_INVALID' => '미디어 파일을 확인해주세요.',
        'MEDIA_UPLOAD_FAILED' => '업로드 권한 발급에 실패했습니다.',
        'MEDIA_ACCESS_FAILED' => '미디어 열람에 실패했습니다.',
        'MESSAGE_INVALID' => '메시지를 확인해주세요.',
        'RATE_LIMITED' => '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
        _ => '요청을 처리하지 못했습니다. ($code)',
      };

  /// Converts an Edge Function error into the app's stable error contract.
  static ApiException _mapFunctionException(
    FunctionException error, {
    required String fallbackCode,
  }) {
    final details = error.details;
    final rawCode = details is Map ? details['error'] : null;
    final message = details is Map && details['message'] is String
        ? details['message'] as String
        : '';
    final code = switch (true) {
      _ when message.contains('MEDIA_VIEW_LIMIT_EXCEEDED') ||
          rawCode == 'MEDIA_VIEW_LIMIT_EXCEEDED' => 'MEDIA_VIEW_LIMIT_EXCEEDED',
      _ when message.contains('MEDIA_INVALID') || rawCode == 'MEDIA_INVALID' =>
        'MEDIA_INVALID',
      _ when message.contains('MESSAGE_NOT_FOUND') ||
          rawCode == 'MESSAGE_NOT_FOUND' => 'MESSAGE_NOT_FOUND',
      _ when message.contains('MESSAGE_INVALID') ||
          rawCode == 'MESSAGE_INVALID' => 'MESSAGE_INVALID',
      _ when message.contains('CHAT_NOT_ACTIVE') ||
          rawCode == 'CHAT_NOT_ACTIVE' => 'CHAT_NOT_ACTIVE',
      _ when message.contains('CHAT_PARTICIPANT_REQUIRED') ||
          rawCode == 'CHAT_PARTICIPANT_REQUIRED' => 'CHAT_PARTICIPANT_REQUIRED',
      _ when message.contains('AUTH_REQUIRED') || rawCode == 'AUTH_REQUIRED' =>
        'AUTH_REQUIRED',
      _ when message.contains('RATE_LIMITED') || rawCode == 'RATE_LIMITED' =>
        'RATE_LIMITED',
      _ when rawCode == 'MEDIA_UPLOAD_SIGN_FAILED' => 'MEDIA_UPLOAD_FAILED',
      _ when rawCode == 'MEDIA_SIGN_FAILED' => 'MEDIA_ACCESS_FAILED',
      _ when error.status == 401 => 'AUTH_REQUIRED',
      _ => fallbackCode,
    };
    return ApiException(code, _messageFor(code));
  }
}
