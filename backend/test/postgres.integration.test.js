import assert from "node:assert/strict";
import test from "node:test";
import { getAppConfig } from "../src/config/env.js";
import { createPostgresRepository } from "../src/db/postgres.js";
import { createService } from "../src/service.js";
import { cleanupTestData } from "./integration-utils.js";

const config = getAppConfig();
const integration = config.databaseUrl ? test : test.skip;
const keepIntegrationData = process.env.POSTGRES_INTEGRATION_KEEP_DATA === "1" || process.env.POSTGRES_INTEGRATION_KEEP_DATA === "true";

integration("Postgres repository persists the documented chat flow", async () => {
  const repository = await createPostgresRepository({
    connectionString: config.databaseUrl,
    ssl: config.dbSsl,
  });

  const prefix = `itest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    await repository.migrate();
    const service = createService({
      repository,
      tokenSecret: config.tokenSecret,
      publicUrl: config.publicUrl,
    });

    const alice = `${prefix}_alice`;
    const bob = `${prefix}_bob`;

    await service.registerUser({ login_id: alice, password: "pw1" });
    await service.registerUser({ login_id: bob, password: "pw2" });

    const aliceLogin = await service.login({ login_id: alice, password: "pw1", device_id: "device-a" });
    const chat = await service.createChat(aliceLogin.access_token);
    assert.equal(chat.status, "waiting");

    const bobLogin = await service.login({ login_id: bob, password: "pw2", device_id: "device-b" });
    const joined = await service.joinChat(bobLogin.access_token, { invite_code: chat.invite_code });
    assert.equal(joined.status, "active");

    const text = await service.sendMessage(aliceLogin.access_token, {
      chat_id: chat.chat_id,
      type: "text",
      text_content: "hello postgres",
    });
    assert.equal(text.type, "text");

    const media = await service.sendMessage(aliceLogin.access_token, {
      chat_id: chat.chat_id,
      type: "media",
      permission_type: "once",
      media_items: [{ url: "https://storage.local/media/test", mime_type: "image/jpeg" }],
    });
    assert.equal(media.type, "media");

    const viewed = await service.accessMedia(bobLogin.access_token, { message_id: media.message_id });
    assert.equal(viewed.view_count, 1);

    const reset = await service.resetChat(aliceLogin.access_token, { chat_id: chat.chat_id });
    assert.equal(reset.chat_id, chat.chat_id);

    const messages = await service.listMessages(aliceLogin.access_token, { chat_id: chat.chat_id });
    assert.equal(messages.messages.length, 0);
  } finally {
    if (!keepIntegrationData) {
      await cleanupTestData(repository.pool, prefix);
    }
    await repository.close();
  }
});
