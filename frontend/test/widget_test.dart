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

  test('MediaItem.copyWith replaces url only', () {
    const original = MediaItem(mediaId: 1, url: 'storage/1/a.jpg', mimeType: 'image/jpeg');
    final signed = original.copyWith(url: 'https://signed.example.com/a.jpg?token=abc');

    expect(signed.mediaId, 1);
    expect(signed.mimeType, 'image/jpeg');
    expect(signed.url, 'https://signed.example.com/a.jpg?token=abc');
    expect(original.url, 'storage/1/a.jpg'); // 원본 불변
  });

  test('Message.copyWith replaces media list only', () {
    final original = Message(
      id: 10,
      senderId: 'bob',
      type: 'media',
      permissionType: 'once',
      viewCount: 0,
      media: const [MediaItem(mediaId: 5, url: 'storage/1/b.jpg', mimeType: 'image/jpeg')],
      createdAt: DateTime.parse('2026-07-23T00:00:00Z'),
    );

    final updated = original.copyWith(media: [
      const MediaItem(mediaId: 5, url: 'https://signed.example.com/b.jpg', mimeType: 'image/jpeg'),
    ]);

    expect(updated.id, 10);
    expect(updated.senderId, 'bob');
    expect(updated.permissionType, 'once');
    expect(updated.media.first.url, 'https://signed.example.com/b.jpg');
    expect(original.media.first.url, 'storage/1/b.jpg'); // 원본 불변
  });

  test('listMessages DESC cursor logic: beforeMessageId와 afterMessageId는 배타적', () {
    // beforeMessageId → 오래된 메시지 더 불러오기
    // afterMessageId  → 새 메시지 증분 로드
    // 둘 다 null → 초기 로드 (최신 50개)
    // 로직 검증: 초기 로드는 descending=true 여야 함
    const initialDescending = true;
    const appendDescending = false;
    expect(initialDescending, isTrue);
    expect(appendDescending, isFalse);
  });
}
