import 'dart:convert';
import 'package:http/http.dart' as http;
import 'constants.dart';

class ApiException implements Exception {
  final String code;
  final String message;
  ApiException(this.code, this.message);

  @override
  String toString() => '[$code] $message';
}

class ApiClient {
  static final _client = http.Client();

  static Future<Map<String, dynamic>> _post(
    String path, {
    Map<String, dynamic>? body,
    String? accessToken,
  }) async {
    final uri = Uri.parse('$kBaseUrl$path');
    final headers = <String, String>{
      'Content-Type': 'application/json; charset=utf-8',
      if (accessToken != null) 'Authorization': 'Bearer $accessToken',
    };
    final response = await _client.post(
      uri,
      headers: headers,
      body: body != null ? jsonEncode(body) : null,
    );
    return _parse(response);
  }

  static Future<Map<String, dynamic>> _get(
    String path, {
    Map<String, String>? query,
    required String accessToken,
  }) async {
    final uri = Uri.parse('$kBaseUrl$path').replace(queryParameters: query);
    final response = await _client.get(
      uri,
      headers: {
        'Authorization': 'Bearer $accessToken',
      },
    );
    return _parse(response);
  }

  static Map<String, dynamic> _parse(http.Response response) {
    final body = jsonDecode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;
    if (response.statusCode >= 400) {
      final err = body['error'] as Map<String, dynamic>? ?? {};
      throw ApiException(
        err['code']?.toString() ?? 'UNKNOWN',
        err['message']?.toString() ?? '오류가 발생했습니다.',
      );
    }
    return body;
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  static Future<Map<String, dynamic>> register(String loginId, String password) =>
      _post('/api/users', body: {'login_id': loginId, 'password': password});

  static Future<Map<String, dynamic>> login(
    String loginId,
    String password,
    String deviceId,
  ) =>
      _post('/api/auth/tokens', body: {
        'login_id': loginId,
        'password': password,
        'device_id': deviceId,
      });

  static Future<Map<String, dynamic>> refreshTokens(
    String loginId,
    String refreshToken,
    String deviceId,
  ) =>
      _post('/api/auth/token-refreshes', body: {
        'login_id': loginId,
        'refresh_token': refreshToken,
        'device_id': deviceId,
      });

  // ── Chat ──────────────────────────────────────────────────────────────────

  static Future<Map<String, dynamic>> getActiveChat(String accessToken) =>
      _get('/api/chats/active', accessToken: accessToken);

  static Future<Map<String, dynamic>> createChat(String accessToken) =>
      _post('/api/chats', accessToken: accessToken);

  static Future<Map<String, dynamic>> joinChat(
    String accessToken,
    String inviteCode,
  ) =>
      _post('/api/chat-participants', body: {'invite_code': inviteCode}, accessToken: accessToken);

  // ── Messages ──────────────────────────────────────────────────────────────

  static Future<Map<String, dynamic>> listMessages(
    String accessToken,
    int chatId, {
    int? afterMessageId,
    int limit = 50,
  }) =>
      _get(
        '/api/chats/$chatId/messages',
        query: {
          'limit': limit.toString(),
          if (afterMessageId != null) 'after_message_id': afterMessageId.toString(),
        },
        accessToken: accessToken,
      );

  static Future<Map<String, dynamic>> sendText(
    String accessToken,
    int chatId,
    String textContent,
  ) =>
      _post('/api/messages', body: {
        'chat_id': chatId,
        'type': 'text',
        'text_content': textContent,
      }, accessToken: accessToken);

  // 미디어 업로드 인텐트 생성 (업로드 URL 발급)
  static Future<Map<String, dynamic>> createMediaUploadIntent(
    String accessToken,
    int chatId,
    List<Map<String, dynamic>> files,
  ) =>
      _post('/api/media-upload-intents', body: {
        'chat_id': chatId,
        'files': files,
      }, accessToken: accessToken);

  // 미디어 메시지 전송 (업로드 완료 후 호출)
  static Future<Map<String, dynamic>> sendMediaMessage(
    String accessToken,
    int chatId,
    String permissionType,
    List<Map<String, String>> mediaItems, {
    String? textContent,
  }) =>
      _post('/api/messages', body: {
        'chat_id': chatId,
        'type': 'media',
        'permission_type': permissionType,
        'media_items': mediaItems,
        if (textContent != null) 'text_content': textContent,
      }, accessToken: accessToken);

  // 미디어 열람 (view_count 차감 후 URL 반환)
  static Future<Map<String, dynamic>> accessMedia(
    String accessToken,
    int messageId,
  ) =>
      _post('/api/media-accesses', body: {'message_id': messageId}, accessToken: accessToken);

  // ── Chat actions ──────────────────────────────────────────────────────────

  static Future<Map<String, dynamic>> resetChat(
    String accessToken,
    int chatId,
  ) =>
      _post('/api/chat-reset-logs', body: {'chat_id': chatId}, accessToken: accessToken);

  static Future<Map<String, dynamic>> leaveChat(
    String accessToken,
    int chatId,
  ) =>
      _post('/api/chat-terminations', body: {'chat_id': chatId}, accessToken: accessToken);
}
