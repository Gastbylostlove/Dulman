import assert from "node:assert/strict";
import test from "node:test";
import { validateLoginInput, validateMediaUploadIntentInput, validateRequestBody } from "../src/request-validation.js";
import { createMemoryStore } from "../src/store.js";
import { createService } from "../src/service.js";

function createClock(start = "2026-06-20T00:00:00.000Z") {
  let current = new Date(start).getTime();
  return {
    now() {
      const value = new Date(current);
      current += 1000;
      return value;
    },
  };
}

test("signup, login, chat flow, and reset are wired to the documented contracts", async () => {
  const store = createMemoryStore();
  const clock = createClock();
  const service = createService({ store, now: () => clock.now(), tokenSecret: "test-secret", publicUrl: "https://assets.test" });

  const signup = await service.registerUser({ login_id: "alice", password: "pw1" });
  assert.equal(signup.login_id, "alice");

  const login = await service.login({ login_id: "alice", password: "pw1", device_id: "device-a" });
  assert.equal(login.login_id, "alice");
  assert.equal(login.current_device_id, "device-a");
  assert.equal(login.active_chat_id, null);

  const chat = await service.createChat(login.access_token);
  assert.equal(chat.status, "waiting");
  assert.ok(chat.invite_code);

  const bobSignup = await service.registerUser({ login_id: "bob", password: "pw2" });
  assert.equal(bobSignup.login_id, "bob");
  const bobLogin = await service.login({ login_id: "bob", password: "pw2", device_id: "device-b" });
  const joined = await service.joinChat(bobLogin.access_token, { invite_code: chat.invite_code });
  assert.equal(joined.status, "active");
  assert.equal(joined.user_b_id, "bob");

  const text = await service.sendMessage(login.access_token, { chat_id: chat.chat_id, type: "text", text_content: "hello" });
  assert.equal(text.type, "text");

  const media = await service.sendMessage(login.access_token, {
    chat_id: chat.chat_id,
    type: "media",
    permission_type: "once",
    media_items: [{ url: "https://assets.test/media/a", mime_type: "image/jpeg" }],
  });
  assert.equal(media.type, "media");

  const view1 = await service.accessMedia(bobLogin.access_token, { message_id: media.message_id });
  assert.equal(view1.view_count, 1);
  assert.equal(view1.media[0].url, "https://assets.test/media/a");

  await assert.rejects(() => service.accessMedia(bobLogin.access_token, { message_id: media.message_id }), /열람 횟수/);

  const reset = await service.resetChat(login.access_token, { chat_id: chat.chat_id });
  assert.equal(reset.chat_id, chat.chat_id);

  const messages = await service.listMessages(login.access_token, { chat_id: chat.chat_id });
  assert.equal(messages.messages.length, 0);
});

test("login and invite-code rate limiting are enforced after five failures", async () => {
  const store = createMemoryStore();
  const clock = createClock();
  const service = createService({ store, now: () => clock.now(), tokenSecret: "test-secret" });

  await service.registerUser({ login_id: "alice", password: "pw1" });

  for (let i = 0; i < 5; i += 1) {
    await assert.rejects(() => service.login({ login_id: "alice", password: "bad", device_id: "device-a" }), /로그인 정보/);
  }

  await assert.rejects(() => service.login({ login_id: "alice", password: "pw1", device_id: "device-a" }), (error) => error.code === "AUTH_RATE_LIMITED");
});

test("media upload intent validates count and size limits", async () => {
  const store = createMemoryStore();
  const clock = createClock();
  const service = createService({ store, now: () => clock.now(), tokenSecret: "test-secret" });

  await service.registerUser({ login_id: "alice", password: "pw1" });
  await service.registerUser({ login_id: "bob", password: "pw2" });
  const login = await service.login({ login_id: "alice", password: "pw1", device_id: "device-a" });
  const chat = await service.createChat(login.access_token);
  const bobLogin = await service.login({ login_id: "bob", password: "pw2", device_id: "device-b" });
  await service.joinChat(bobLogin.access_token, { invite_code: chat.invite_code });

  const intent = await service.createMediaUploadIntent(login.access_token, {
    chat_id: chat.chat_id,
    files: [{ client_file_id: "f1", mime_type: "image/jpeg", byte_size: 1024 }],
  });

  assert.equal(intent.upload_items.length, 1);
  assert.match(intent.upload_items[0].upload_url, /\/uploads\//);
});

test("request boundary validation rejects malformed payloads", () => {
  assert.throws(() => validateRequestBody([]), (error) => error.code === "REQUEST_VALIDATION_FAILED");
  assert.throws(() => validateLoginInput({ login_id: "alice", password: "pw1" }), (error) => error.code === "REQUEST_VALIDATION_FAILED");
  assert.throws(() => validateMediaUploadIntentInput({ chat_id: 1, files: [] }), (error) => error.code === "REQUEST_VALIDATION_FAILED");
});
