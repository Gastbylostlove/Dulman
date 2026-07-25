import assert from 'node:assert/strict';
import test from 'node:test';

import {validateMediaFiles} from '../functions/_shared/media_upload_validation.ts';

test('accepts the supported per-file and total limits', () => {
  assert.deepEqual(validateMediaFiles([
    {mime_type: 'image/png', byte_size: 20 * 1024 * 1024},
    {mime_type: 'video/mp4', byte_size: 200 * 1024 * 1024},
  ]), [
    {mime_type: 'image/png', byte_size: 20 * 1024 * 1024},
    {mime_type: 'video/mp4', byte_size: 200 * 1024 * 1024},
  ]);
});

test('rejects unsupported, oversized, empty, and excessive declarations', () => {
  assert.throws(() => validateMediaFiles([]), /MEDIA_INVALID/);
  assert.throws(
    () => validateMediaFiles([{mime_type: 'image/heic', byte_size: 1}]),
    /MEDIA_INVALID/,
  );
  assert.throws(
    () => validateMediaFiles([{mime_type: 'image/jpeg', byte_size: 20 * 1024 * 1024 + 1}]),
    /MEDIA_INVALID/,
  );
  assert.throws(
    () => validateMediaFiles(Array.from(
      {length: 11},
      () => ({mime_type: 'image/jpeg', byte_size: 1}),
    )),
    /MEDIA_INVALID/,
  );
});
