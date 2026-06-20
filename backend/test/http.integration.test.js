import assert from "node:assert/strict";
import test, { after, before, describe } from "node:test";
import { getAppConfig } from "../src/config/env.js";
import { createPostgresRepository } from "../src/db/postgres.js";
import { startServer } from "../src/server.js";
import { cleanupTestData } from "./integration-utils.js";

const config = getAppConfig();
const integration = config.databaseUrl ? describe : describe.skip;
const originalPort = process.env.PORT;
const keepIntegrationData = process.env.HTTP_INTEGRATION_KEEP_DATA === "1" || process.env.HTTP_INTEGRATION_KEEP_DATA === "true";

let repository;
let server;
let baseUrl;

integration("HTTP integration", () => {

before(async () => {
  process.env.PORT = "0";

  repository = await createPostgresRepository({
    connectionString: config.databaseUrl,
    ssl: config.dbSsl,
  });
  await repository.migrate();

  server = await startServer();
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
    if (typeof server.dispose === "function") {
      await server.dispose();
    }
  }

  if (repository) {
    await repository.close();
  }

  if (originalPort === undefined) {
    delete process.env.PORT;
  } else {
    process.env.PORT = originalPort;
  }
});

/**
 * Runs an HTTP integration scenario with isolated cleanup.
 *
 * @param {(prefix: string) => Promise<void>} scenario
 * @returns {Promise<void>}
 */
async function withScenario(scenario) {
  const prefix = createScenarioPrefix();
  try {
    await scenario(prefix);
  } finally {
    if (!keepIntegrationData) {
      await cleanupTestData(repository.pool, prefix);
    }
  }
}

/**
 * Sends a JSON request against the test server and parses the JSON response.
 *
 * @param {string} path
 * @param {object} [options]
 * @param {string} [options.method]
 * @param {string} [options.token]
 * @param {string} [options.authorizationHeader]
 * @param {object} [options.body]
 * @returns {Promise<{ status: number, body: any }>}
 */
async function requestJson(path, { method = "GET", token, authorizationHeader, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(authorizationHeader ? { authorization: authorizationHeader } : token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: response.status,
    body: await response.json(),
  };
}

/**
 * Creates a unique, LIKE-safe prefix for test data.
 *
 * @returns {string}
 */
function createScenarioPrefix() {
  return `http${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Creates a user and returns their access token.
 *
 * @param {string} loginId
 * @param {string} password
 * @param {string} deviceId
 * @returns {Promise<{ loginId: string, accessToken: string }>}
 */
async function createAuthenticatedUser(loginId, password, deviceId) {
  const signup = await requestJson("/api/users", {
    method: "POST",
    body: { login_id: loginId, password },
  });
  assert.equal(signup.status, 200);
  assert.equal(signup.body.login_id, loginId);

  const login = await requestJson("/api/auth/tokens", {
    method: "POST",
    body: { login_id: loginId, password, device_id: deviceId },
  });
  assert.equal(login.status, 200);
  assert.equal(login.body.login_id, loginId);
  assert.equal(login.body.current_device_id, deviceId);

  return {
    loginId,
    accessToken: login.body.access_token,
  };
}

/**
 * Creates an active chat with two authenticated participants.
 *
 * @param {string} prefix
 * @returns {Promise<{ alice: { loginId: string, accessToken: string }, bob: { loginId: string, accessToken: string }, chatId: number }>}
 */
async function createActiveChat(prefix) {
  const alice = await createAuthenticatedUser(`${prefix}a`, "pw-a", `${prefix}-device-a`);
  const bob = await createAuthenticatedUser(`${prefix}b`, "pw-b", `${prefix}-device-b`);

  const chat = await requestJson("/api/chats", {
    method: "POST",
    token: alice.accessToken,
  });
  assert.equal(chat.status, 200);
  assert.equal(chat.body.status, "waiting");

  const joined = await requestJson("/api/chat-participants", {
    method: "POST",
    token: bob.accessToken,
    body: { invite_code: chat.body.invite_code },
  });
  assert.equal(joined.status, 200);
  assert.equal(joined.body.status, "active");
  assert.equal(joined.body.user_b_id, bob.loginId);

  return {
    alice,
    bob,
    chatId: chat.body.chat_id,
  };
}

/**
 * Creates a media message with a single upload item.
 *
 * @param {object} params
 * @param {string} params.token
 * @param {number} params.chatId
 * @param {string} params.permissionType
 * @param {string} params.clientFileId
 * @returns {Promise<{ messageId: number, mediaUrl: string }>}
 */
async function createMediaMessage({ token, chatId, permissionType, clientFileId }) {
  const intent = await requestJson("/api/media-upload-intents", {
    method: "POST",
    token,
    body: {
      chat_id: chatId,
      files: [
        {
          client_file_id: clientFileId,
          mime_type: "image/jpeg",
          byte_size: 1024,
        },
      ],
    },
  });
  assert.equal(intent.status, 200);
  assert.equal(intent.body.upload_items.length, 1);

  const mediaUrl = intent.body.upload_items[0].media_url;
  const message = await requestJson("/api/messages", {
    method: "POST",
    token,
    body: {
      chat_id: chatId,
      type: "media",
      permission_type: permissionType,
      media_items: [
        {
          url: mediaUrl,
          mime_type: "image/jpeg",
        },
      ],
    },
  });
  assert.equal(message.status, 200);
  assert.equal(message.body.permission_type, permissionType);

  return {
    messageId: message.body.message_id,
    mediaUrl,
  };
}

/**
 * Asserts a structured HTTP error response.
 *
 * @param {{ status: number, body: { error: { code: string } } }} response
 * @param {number} status
 * @param {string} code
 * @returns {void}
 */
function assertHttpError(response, status, code) {
  assert.equal(response.status, status);
  assert.equal(response.body.error.code, code);
}

test("HTTP happy path persists reset logs and clears messages after reset", async () => {
  await withScenario(async (prefix) => {
    const { alice, bob, chatId } = await createActiveChat(prefix);

    const text = await requestJson("/api/messages", {
      method: "POST",
      token: alice.accessToken,
      body: {
        chat_id: chatId,
        type: "text",
        text_content: "hello http",
      },
    });
    assert.equal(text.status, 200);
    assert.equal(text.body.type, "text");

    const media = await createMediaMessage({
      token: alice.accessToken,
      chatId,
      permissionType: "once",
      clientFileId: `${prefix}-media-1`,
    });

    const messagesBeforeReset = await requestJson(`/api/chats/${chatId}/messages`, {
      token: alice.accessToken,
    });
    assert.equal(messagesBeforeReset.status, 200);
    assert.equal(messagesBeforeReset.body.messages.length, 2);
    assert.equal(messagesBeforeReset.body.messages[1].permission_type, "once");
    assert.equal(messagesBeforeReset.body.messages[1].media[0].url, media.mediaUrl);

    const viewed = await requestJson("/api/media-accesses", {
      method: "POST",
      token: bob.accessToken,
      body: { message_id: media.messageId },
    });
    assert.equal(viewed.status, 200);
    assert.equal(viewed.body.view_count, 1);
    assert.equal(viewed.body.media[0].url, media.mediaUrl);

    const reset = await requestJson("/api/chat-reset-logs", {
      method: "POST",
      token: bob.accessToken,
      body: { chat_id: chatId },
    });
    assert.equal(reset.status, 200);
    assert.equal(reset.body.chat_id, chatId);

    const { rows } = await repository.pool.query(
      `SELECT chat_id, reset_by_user_id, reset_at
       FROM chat_reset_log
       WHERE chat_id = $1
       ORDER BY id DESC
       LIMIT 1`,
      [chatId],
    );
    assert.equal(rows.length, 1);
    assert.equal(String(rows[0].chat_id), String(chatId));
    assert.equal(rows[0].reset_by_user_id, bob.loginId);
    assert.ok(rows[0].reset_at);

    const messagesAfterReset = await requestJson(`/api/chats/${chatId}/messages`, {
      token: alice.accessToken,
    });
    assert.equal(messagesAfterReset.status, 200);
    assert.equal(messagesAfterReset.body.messages.length, 0);
  });
});

test("HTTP media permissions enforce once, replay_once, and keep access limits", async () => {
  await withScenario(async (prefix) => {
    const { alice, bob, chatId } = await createActiveChat(prefix);

    const onceMedia = await createMediaMessage({
      token: alice.accessToken,
      chatId,
      permissionType: "once",
      clientFileId: `${prefix}-once`,
    });
    const onceFirst = await requestJson("/api/media-accesses", {
      method: "POST",
      token: bob.accessToken,
      body: { message_id: onceMedia.messageId },
    });
    assert.equal(onceFirst.status, 200);
    assert.equal(onceFirst.body.view_count, 1);
    const onceSecond = await requestJson("/api/media-accesses", {
      method: "POST",
      token: bob.accessToken,
      body: { message_id: onceMedia.messageId },
    });
    assertHttpError(onceSecond, 403, "MEDIA_VIEW_LIMIT_EXCEEDED");

    const replayOnceMedia = await createMediaMessage({
      token: alice.accessToken,
      chatId,
      permissionType: "replay_once",
      clientFileId: `${prefix}-replay`,
    });
    const replayFirst = await requestJson("/api/media-accesses", {
      method: "POST",
      token: bob.accessToken,
      body: { message_id: replayOnceMedia.messageId },
    });
    assert.equal(replayFirst.status, 200);
    assert.equal(replayFirst.body.view_count, 1);
    const replaySecond = await requestJson("/api/media-accesses", {
      method: "POST",
      token: bob.accessToken,
      body: { message_id: replayOnceMedia.messageId },
    });
    assert.equal(replaySecond.status, 200);
    assert.equal(replaySecond.body.view_count, 2);
    const replayThird = await requestJson("/api/media-accesses", {
      method: "POST",
      token: bob.accessToken,
      body: { message_id: replayOnceMedia.messageId },
    });
    assertHttpError(replayThird, 403, "MEDIA_VIEW_LIMIT_EXCEEDED");

    const keepMedia = await createMediaMessage({
      token: alice.accessToken,
      chatId,
      permissionType: "keep",
      clientFileId: `${prefix}-keep`,
    });
    const keepFirst = await requestJson("/api/media-accesses", {
      method: "POST",
      token: bob.accessToken,
      body: { message_id: keepMedia.messageId },
    });
    assert.equal(keepFirst.status, 200);
    assert.equal(keepFirst.body.view_count, 1);
    const keepSecond = await requestJson("/api/media-accesses", {
      method: "POST",
      token: bob.accessToken,
      body: { message_id: keepMedia.messageId },
    });
    assert.equal(keepSecond.status, 200);
    assert.equal(keepSecond.body.view_count, 2);
    const keepThird = await requestJson("/api/media-accesses", {
      method: "POST",
      token: bob.accessToken,
      body: { message_id: keepMedia.messageId },
    });
    assert.equal(keepThird.status, 200);
    assert.equal(keepThird.body.view_count, 3);
  });
});

test("HTTP chat termination returns ended state and blocks follow-up access", async () => {
  await withScenario(async (prefix) => {
    const { alice, bob, chatId } = await createActiveChat(prefix);

    const terminated = await requestJson("/api/chat-terminations", {
      method: "POST",
      token: bob.accessToken,
      body: { chat_id: chatId },
    });
    assert.equal(terminated.status, 200);
    assert.equal(terminated.body.chat_id, chatId);
    assert.equal(terminated.body.status, "ended");
    assert.equal(terminated.body.ended_by_user_id, bob.loginId);
    assert.ok(terminated.body.ended_at);

    const activeChat = await requestJson("/api/chats/active", {
      token: alice.accessToken,
    });
    assert.equal(activeChat.status, 200);
    assert.equal(activeChat.body.active_chat_id, null);

    const messagesAfterTermination = await requestJson(`/api/chats/${chatId}/messages`, {
      token: alice.accessToken,
    });
    assertHttpError(messagesAfterTermination, 409, "CHAT_NOT_ACTIVE");

    const mediaIntentAfterTermination = await requestJson("/api/media-upload-intents", {
      method: "POST",
      token: alice.accessToken,
      body: {
        chat_id: chatId,
        files: [
          {
            client_file_id: `${prefix}-after-end`,
            mime_type: "image/jpeg",
            byte_size: 1024,
          },
        ],
      },
    });
    assertHttpError(mediaIntentAfterTermination, 409, "CHAT_NOT_ACTIVE");
  });
});

test("HTTP unhappy paths reject non-participants, ended chats, and missing chats", async () => {
  await withScenario(async (prefix) => {
    const { alice, bob, chatId } = await createActiveChat(prefix);
    const outsider = await createAuthenticatedUser(`${prefix}x`, "pw-x", `${prefix}-device-x`);

    const media = await createMediaMessage({
      token: alice.accessToken,
      chatId,
      permissionType: "once",
      clientFileId: `${prefix}-media-unhappy`,
    });

    const mediaByOutsider = await requestJson("/api/media-accesses", {
      method: "POST",
      token: outsider.accessToken,
      body: { message_id: media.messageId },
    });
    assertHttpError(mediaByOutsider, 403, "CHAT_PARTICIPANT_REQUIRED");

    const resetByOutsider = await requestJson("/api/chat-reset-logs", {
      method: "POST",
      token: outsider.accessToken,
      body: { chat_id: chatId },
    });
    assertHttpError(resetByOutsider, 403, "CHAT_PARTICIPANT_REQUIRED");

    const missingReset = await requestJson("/api/chat-reset-logs", {
      method: "POST",
      token: alice.accessToken,
      body: { chat_id: chatId + 999999 },
    });
    assertHttpError(missingReset, 404, "CHAT_NOT_FOUND");

    const terminated = await requestJson("/api/chat-terminations", {
      method: "POST",
      token: bob.accessToken,
      body: { chat_id: chatId },
    });
    assert.equal(terminated.status, 200);

    const mediaAfterTermination = await requestJson("/api/media-accesses", {
      method: "POST",
      token: alice.accessToken,
      body: { message_id: media.messageId },
    });
    assertHttpError(mediaAfterTermination, 409, "CHAT_NOT_ACTIVE");
  });
});

test("HTTP request validation rejects malformed bodies and invalid media permission types", async () => {
  await withScenario(async (prefix) => {
    const { alice, chatId } = await createActiveChat(prefix);

    const malformedBody = await requestJson("/api/messages", {
      method: "POST",
      token: alice.accessToken,
      body: [],
    });
    assertHttpError(malformedBody, 400, "REQUEST_VALIDATION_FAILED");

    const invalidPermissionType = await requestJson("/api/messages", {
      method: "POST",
      token: alice.accessToken,
      body: {
        chat_id: chatId,
        type: "media",
        permission_type: "invalid",
        media_items: [
          {
            url: `${config.publicUrl}/media/${prefix}/x`,
            mime_type: "image/jpeg",
          },
        ],
      },
    });
    assertHttpError(invalidPermissionType, 400, "REQUEST_VALIDATION_FAILED");
  });
});

test("HTTP auth tokens and refreshes enforce credential, session, and device contracts", async () => {
  await withScenario(async (prefix) => {
    const loginId = `${prefix}auth`;
    const password = "pw-auth";

    const signup = await requestJson("/api/users", {
      method: "POST",
      body: { login_id: loginId, password },
    });
    assert.equal(signup.status, 200);

    const invalidCredentials = await requestJson("/api/auth/tokens", {
      method: "POST",
      body: {
        login_id: loginId,
        password: "wrong-password",
        device_id: `${prefix}-device-a`,
      },
    });
    assertHttpError(invalidCredentials, 401, "AUTH_INVALID_CREDENTIALS");

    for (let i = 0; i < 4; i += 1) {
      const retry = await requestJson("/api/auth/tokens", {
        method: "POST",
        body: {
          login_id: loginId,
          password: "wrong-password",
          device_id: `${prefix}-device-a`,
        },
      });
      assertHttpError(retry, 401, "AUTH_INVALID_CREDENTIALS");
    }

    const rateLimited = await requestJson("/api/auth/tokens", {
      method: "POST",
      body: {
        login_id: loginId,
        password: "wrong-password",
        device_id: `${prefix}-device-a`,
      },
    });
    assertHttpError(rateLimited, 429, "AUTH_RATE_LIMITED");

    const refreshValidationFailed = await requestJson("/api/auth/token-refreshes", {
      method: "POST",
      body: {},
    });
    assertHttpError(refreshValidationFailed, 400, "REQUEST_VALIDATION_FAILED");

    const freshLoginId = `${prefix}session`;
    const freshPassword = "pw-session";
    const freshSignup = await requestJson("/api/users", {
      method: "POST",
      body: { login_id: freshLoginId, password: freshPassword },
    });
    assert.equal(freshSignup.status, 200);

    const firstLogin = await requestJson("/api/auth/tokens", {
      method: "POST",
      body: {
        login_id: freshLoginId,
        password: freshPassword,
        device_id: `${prefix}-device-old`,
      },
    });
    assert.equal(firstLogin.status, 200);

    const secondLogin = await requestJson("/api/auth/tokens", {
      method: "POST",
      body: {
        login_id: freshLoginId,
        password: freshPassword,
        device_id: `${prefix}-device-new`,
      },
    });
    assert.equal(secondLogin.status, 200);

    const oldAccessRejected = await requestJson("/api/chats/active", {
      token: firstLogin.body.access_token,
    });
    assertHttpError(oldAccessRejected, 401, "AUTH_DEVICE_REPLACED");

    const refreshSessionExpired = await requestJson("/api/auth/token-refreshes", {
      method: "POST",
      body: {
        login_id: freshLoginId,
        refresh_token: "not-a-real-refresh-token",
        device_id: `${prefix}-device-new`,
      },
    });
    assertHttpError(refreshSessionExpired, 401, "AUTH_SESSION_EXPIRED");

    const refreshDeviceReplaced = await requestJson("/api/auth/token-refreshes", {
      method: "POST",
      body: {
        login_id: freshLoginId,
        refresh_token: secondLogin.body.refresh_token,
        device_id: `${prefix}-device-old`,
      },
    });
    assertHttpError(refreshDeviceReplaced, 401, "AUTH_DEVICE_REPLACED");
  });
});

test("HTTP protected endpoints reject missing and malformed authorization headers", async () => {
  await withScenario(async () => {
    const protectedRequests = [
      {
        path: "/api/chats/active",
        options: {},
      },
      {
        path: "/api/media-upload-intents",
        options: {
          method: "POST",
          body: {
            chat_id: 1,
            files: [
              {
                client_file_id: "f1",
                mime_type: "image/jpeg",
                byte_size: 1024,
              },
            ],
          },
        },
      },
      {
        path: "/api/messages",
        options: {
          method: "POST",
          body: {
            chat_id: 1,
            type: "text",
            text_content: "hello",
          },
        },
      },
      {
        path: "/api/media-accesses",
        options: {
          method: "POST",
          body: { message_id: 1 },
        },
      },
      {
        path: "/api/chat-reset-logs",
        options: {
          method: "POST",
          body: { chat_id: 1 },
        },
      },
      {
        path: "/api/chat-terminations",
        options: {
          method: "POST",
          body: { chat_id: 1 },
        },
      },
    ];

    for (const request of protectedRequests) {
      const missingAuthorization = await requestJson(request.path, request.options);
      assertHttpError(missingAuthorization, 401, "AUTH_SESSION_EXPIRED");

      const malformedBearer = await requestJson(request.path, {
        ...request.options,
        authorizationHeader: "Bearer",
      });
      assertHttpError(malformedBearer, 401, "AUTH_SESSION_EXPIRED");

      const malformedScheme = await requestJson(request.path, {
        ...request.options,
        authorizationHeader: "Basic abc",
      });
      assertHttpError(malformedScheme, 401, "AUTH_SESSION_EXPIRED");
    }
  });
});

test("HTTP invite-code attempts are rate limited after repeated failures", async () => {
  await withScenario(async (prefix) => {
    const alice = await createAuthenticatedUser(`${prefix}invite-a`, "pw-a", `${prefix}-device-a`);
    const bob = await createAuthenticatedUser(`${prefix}invite-b`, "pw-b", `${prefix}-device-b`);

    const chat = await requestJson("/api/chats", {
      method: "POST",
      token: alice.accessToken,
    });
    assert.equal(chat.status, 200);

    for (let i = 0; i < 5; i += 1) {
      const attempt = await requestJson("/api/chat-participants", {
        method: "POST",
        token: bob.accessToken,
        body: { invite_code: `${prefix}-missing-${i}` },
      });
      assertHttpError(attempt, 404, "CHAT_INVITE_NOT_FOUND");
    }

    const rateLimited = await requestJson("/api/chat-participants", {
      method: "POST",
      token: bob.accessToken,
      body: { invite_code: `${prefix}-missing-final` },
    });
    assertHttpError(rateLimited, 429, "CHAT_INVITE_RATE_LIMITED");
  });
});

test("HTTP media-upload-intents enforce participant, state, and size limits", async () => {
  await withScenario(async (prefix) => {
    const { alice, bob, chatId } = await createActiveChat(prefix);
    const outsider = await createAuthenticatedUser(`${prefix}z`, "pw-z", `${prefix}-device-z`);

    const outsiderIntent = await requestJson("/api/media-upload-intents", {
      method: "POST",
      token: outsider.accessToken,
      body: {
        chat_id: chatId,
        files: [
          {
            client_file_id: `${prefix}-outsider`,
            mime_type: "image/jpeg",
            byte_size: 1024,
          },
        ],
      },
    });
    assertHttpError(outsiderIntent, 403, "CHAT_PARTICIPANT_REQUIRED");

    const largeBatch = await requestJson("/api/media-upload-intents", {
      method: "POST",
      token: alice.accessToken,
      body: {
        chat_id: chatId,
        files: [
          {
            client_file_id: `${prefix}-big-1`,
            mime_type: "image/jpeg",
            byte_size: 20 * 1024 * 1024,
          },
          {
            client_file_id: `${prefix}-big-2`,
            mime_type: "image/jpeg",
            byte_size: 20 * 1024 * 1024,
          },
          {
            client_file_id: `${prefix}-big-3`,
            mime_type: "image/jpeg",
            byte_size: 20 * 1024 * 1024,
          },
          {
            client_file_id: `${prefix}-big-4`,
            mime_type: "image/jpeg",
            byte_size: 20 * 1024 * 1024,
          },
          {
            client_file_id: `${prefix}-big-5`,
            mime_type: "image/jpeg",
            byte_size: 20 * 1024 * 1024,
          },
          {
            client_file_id: `${prefix}-big-6`,
            mime_type: "image/jpeg",
            byte_size: 20 * 1024 * 1024,
          },
          {
            client_file_id: `${prefix}-big-7`,
            mime_type: "image/jpeg",
            byte_size: 20 * 1024 * 1024,
          },
          {
            client_file_id: `${prefix}-big-8`,
            mime_type: "image/jpeg",
            byte_size: 20 * 1024 * 1024,
          },
          {
            client_file_id: `${prefix}-big-9`,
            mime_type: "image/jpeg",
            byte_size: 20 * 1024 * 1024,
          },
          {
            client_file_id: `${prefix}-big-10`,
            mime_type: "image/jpeg",
            byte_size: 20 * 1024 * 1024,
          },
          {
            client_file_id: `${prefix}-big-11`,
            mime_type: "image/jpeg",
            byte_size: 20 * 1024 * 1024,
          },
        ],
      },
    });
    assertHttpError(largeBatch, 413, "MEDIA_LIMIT_EXCEEDED");

    const terminated = await requestJson("/api/chat-terminations", {
      method: "POST",
      token: bob.accessToken,
      body: { chat_id: chatId },
    });
    assert.equal(terminated.status, 200);

    const intentAfterTermination = await requestJson("/api/media-upload-intents", {
      method: "POST",
      token: alice.accessToken,
      body: {
        chat_id: chatId,
        files: [
          {
            client_file_id: `${prefix}-ended`,
            mime_type: "image/jpeg",
            byte_size: 1024,
          },
        ],
      },
    });
    assertHttpError(intentAfterTermination, 409, "CHAT_NOT_ACTIVE");
  });
});

test("HTTP messages enforce participant, state, and payload requirements", async () => {
  await withScenario(async (prefix) => {
    const { alice, bob, chatId } = await createActiveChat(prefix);
    const outsider = await createAuthenticatedUser(`${prefix}y`, "pw-y", `${prefix}-device-y`);

    const outsiderText = await requestJson("/api/messages", {
      method: "POST",
      token: outsider.accessToken,
      body: {
        chat_id: chatId,
        type: "text",
        text_content: "outsider",
      },
    });
    assertHttpError(outsiderText, 403, "CHAT_PARTICIPANT_REQUIRED");

    const emptyText = await requestJson("/api/messages", {
      method: "POST",
      token: alice.accessToken,
      body: {
        chat_id: chatId,
        type: "text",
      },
    });
    assertHttpError(emptyText, 400, "MESSAGE_EMPTY");

    const emptyMedia = await requestJson("/api/messages", {
      method: "POST",
      token: alice.accessToken,
      body: {
        chat_id: chatId,
        type: "media",
        permission_type: "once",
        media_items: [],
      },
    });
    assertHttpError(emptyMedia, 400, "REQUEST_VALIDATION_FAILED");

    const terminated = await requestJson("/api/chat-terminations", {
      method: "POST",
      token: bob.accessToken,
      body: { chat_id: chatId },
    });
    assert.equal(terminated.status, 200);

    const textAfterTermination = await requestJson("/api/messages", {
      method: "POST",
      token: alice.accessToken,
      body: {
        chat_id: chatId,
        type: "text",
        text_content: "after ended",
      },
    });
    assertHttpError(textAfterTermination, 409, "CHAT_NOT_ACTIVE");

    const mediaAfterTermination = await requestJson("/api/messages", {
      method: "POST",
      token: alice.accessToken,
      body: {
        chat_id: chatId,
        type: "media",
        permission_type: "keep",
        media_items: [
          {
            url: `${config.publicUrl}/media/${prefix}/after-ended`,
            mime_type: "image/jpeg",
          },
        ],
      },
    });
    assertHttpError(mediaAfterTermination, 409, "CHAT_NOT_ACTIVE");
  });
});

}); // integration
