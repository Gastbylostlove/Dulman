import 'package:flutter_test/flutter_test.dart';
import 'package:dulman_flutter/data/local_database.dart';

void main() {
  test('LocalDatabase initializes and FTS returns message metadata', () async {
    final database = await LocalDatabase.openInMemory();
    addTearDown(database.close);

    await database.cacheMessage(
      id: 1,
      chatId: 7,
      senderId: 'alice',
      type: 'text',
      textContent: 'hello drift',
      createdAt: '2026-07-25T00:00:00Z',
    );

    final results = await database.search(chatId: 7, query: 'hello');

    expect(results, hasLength(1));
    expect(results.single['sender_id'], 'alice');
    expect(results.single['type'], 'text');
    expect(results.single['created_at'], '2026-07-25T00:00:00Z');
  });
}
