import 'package:flutter_test/flutter_test.dart';
import 'package:dulman_flutter/models/models.dart';

void main() {
  test('media permission labels and view rules follow the API contract', () {
    final once = Message(
      id: 1,
      senderId: 'alice',
      type: 'media',
      viewCount: 0,
      media: const [
        MediaItem(
          mediaId: 11,
          url: 'https://example.com/a.jpg',
          mimeType: 'image/jpeg',
        ),
      ],
      createdAt: DateTime.parse('2026-06-21T00:00:00Z'),
      permissionType: 'once',
    );

    expect(once.permissionLabel, '일회용');
    expect(once.canView, isTrue);

    final onceViewed = Message(
      id: 1,
      senderId: 'alice',
      type: 'media',
      viewCount: 1,
      media: const [
        MediaItem(
          mediaId: 11,
          url: 'https://example.com/a.jpg',
          mimeType: 'image/jpeg',
        ),
      ],
      createdAt: DateTime.parse('2026-06-21T00:00:00Z'),
      permissionType: 'once',
    );

    expect(onceViewed.canView, isFalse);

    final replayOnce = Message(
      id: 2,
      senderId: 'alice',
      type: 'media',
      viewCount: 1,
      media: const [
        MediaItem(
          mediaId: 12,
          url: 'https://example.com/b.jpg',
          mimeType: 'image/jpeg',
        ),
      ],
      createdAt: DateTime.parse('2026-06-21T00:00:00Z'),
      permissionType: 'replay_once',
    );

    expect(replayOnce.permissionLabel, '다시보기');
    expect(replayOnce.canView, isTrue);

    final replayTwice = Message(
      id: 2,
      senderId: 'alice',
      type: 'media',
      viewCount: 2,
      media: const [
        MediaItem(
          mediaId: 12,
          url: 'https://example.com/b.jpg',
          mimeType: 'image/jpeg',
        ),
      ],
      createdAt: DateTime.parse('2026-06-21T00:00:00Z'),
      permissionType: 'replay_once',
    );

    expect(replayTwice.canView, isFalse);

    final keep = Message(
      id: 3,
      senderId: 'alice',
      type: 'media',
      viewCount: 99,
      media: const [
        MediaItem(
          mediaId: 13,
          url: 'https://example.com/c.jpg',
          mimeType: 'image/jpeg',
        ),
      ],
      createdAt: DateTime.parse('2026-06-21T00:00:00Z'),
      permissionType: 'keep',
    );

    expect(keep.permissionLabel, '보관');
    expect(keep.canView, isTrue);
  });
}
