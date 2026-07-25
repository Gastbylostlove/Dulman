import assert from 'node:assert/strict';
import test from 'node:test';

import {grantMediaAccess} from '../functions/_shared/access_media_flow.ts';

test('does not consume a limited view when signing fails', async () => {
  let consumed = false;

  await assert.rejects(() => grantMediaAccess(
    1,
    async () => [{storage_path: '1/a.jpg'}],
    async () => { throw new Error('MEDIA_SIGN_FAILED'); },
    async () => { consumed = true; },
  ));

  assert.equal(consumed, false);
});

test('consumes only after every url is signed', async () => {
  const events: string[] = [];

  const urls = await grantMediaAccess(
    1,
    async () => [{storage_path: '1/a.jpg'}, {storage_path: '1/b.jpg'}],
    async (path) => {
      events.push(`sign:${path}`);
      return `signed:${path}`;
    },
    async () => { events.push('consume'); },
  );

  assert.deepEqual(urls, ['signed:1/a.jpg', 'signed:1/b.jpg']);
  assert.deepEqual(events, ['sign:1/a.jpg', 'sign:1/b.jpg', 'consume']);
});
