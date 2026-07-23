import 'dart:io';

import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:path_provider/path_provider.dart';

class LocalDatabase implements QueryExecutorUser {
  LocalDatabase._(this._executor);

  final QueryExecutor _executor;

  @override
  int get schemaVersion => 1;

  @override
  Future<void> beforeOpen(QueryExecutor executor, OpeningDetails details) async {
    // _BeforeOpeningExecutor는 ensureOpen 호출 시 open 상태로 표시됨
    await executor.ensureOpen(this);
    if (details.wasCreated || details.hadUpgrade) {
      await _createSchema(executor);
    }
  }

  static Future<LocalDatabase> open() async {
    final directory = await getApplicationDocumentsDirectory();
    final executor = LazyDatabase(() async {
      return NativeDatabase(File('${directory.path}/dulman.sqlite3'));
    });
    final database = LocalDatabase._(executor);
    await executor.ensureOpen(database);
    return database;
  }

  Future<void> _createSchema(QueryExecutor executor) async {
    await executor.runCustom('''
      CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY,
        chat_id INTEGER NOT NULL,
        sender_id TEXT NOT NULL,
        type TEXT NOT NULL,
        text_content TEXT,
        created_at TEXT NOT NULL
      )
    ''');
    await executor.runCustom('''
      CREATE VIRTUAL TABLE IF NOT EXISTS chat_messages_fts
      USING fts5(text_content, id UNINDEXED, chat_id UNINDEXED)
    ''');
    await executor.runCustom('''
      CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_id_id
      ON chat_messages(chat_id, id)
    ''');
  }

  Future<void> cacheMessage({
    required int id,
    required int chatId,
    required String senderId,
    required String type,
    required String? textContent,
    required String createdAt,
  }) async {
    await _executor.runInsert(
      '''
      INSERT OR REPLACE INTO chat_messages
        (id, chat_id, sender_id, type, text_content, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ''',
      [id, chatId, senderId, type, textContent, createdAt],
    );
    await _executor.runCustom(
      'DELETE FROM chat_messages_fts WHERE id = ?',
      [id],
    );
    if (textContent != null && textContent.isNotEmpty) {
      await _executor.runInsert(
        'INSERT INTO chat_messages_fts (text_content, id, chat_id) VALUES (?, ?, ?)',
        [textContent, id, chatId],
      );
    }
  }

  Future<List<Map<String, Object?>>> search({
    required int chatId,
    required String query,
    int limit = 50,
  }) {
    return _executor.runSelect(
      '''
      SELECT id, chat_id, sender_id, type, text_content, created_at
      FROM chat_messages_fts
      WHERE chat_id = ? AND chat_messages_fts MATCH ?
      ORDER BY id DESC
      LIMIT ?
      ''',
      [chatId, query, limit],
    );
  }

  Future<void> close() => _executor.close();
}
