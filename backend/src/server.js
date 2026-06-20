import http from "node:http";
import { getAppConfig } from "./config/env.js";
import {
  validateChatIdInput,
  validateInviteCodeInput,
  validateLoginInput,
  validateMediaAccessInput,
  validateMediaUploadIntentInput,
  validateMessageListQuery,
  validateRefreshTokenInput,
  validateRegistrationInput,
  validateRequestBody,
  validateSendMessageInput,
} from "./request-validation.js";
import { mapAppErrorToHttpStatus, serializeErrorResponse } from "./http-errors.js";
import { createMemoryStore } from "./store.js";
import { createService } from "./service.js";
import { createAppError } from "./errors.js";
import { ERROR_CODES } from "./constants.js";

let runtimePromise = null;

/**
 * Starts the HTTP server with the repository selected from local env config.
 *
 * @returns {Promise<http.Server>}
 */
export async function startServer() {
  const runtime = await getRuntime();
  logRuntimeConfig(runtime.config);
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");

    try {
      const body = await readJsonBody(req);
      const result = await routeRequest(runtime.service, req.method ?? "GET", url, body, req.headers.authorization);
      sendJson(res, 200, result);
    } catch (error) {
      sendError(res, error);
    }
  });
  Object.defineProperty(server, "dispose", {
    value: async () => {
      if (typeof runtime.repository.close === "function") {
        await runtime.repository.close();
      }
    },
  });

  await new Promise((resolve) => {
    server.listen(runtime.config.port, resolve);
  });

  return server;
}

async function getRuntime() {
  if (!runtimePromise) {
    runtimePromise = initializeRuntime();
  }
  return runtimePromise;
}

async function initializeRuntime() {
  const config = getAppConfig();

  if (config.dbProvider === "postgres") {
    const { createPostgresRepository } = await import("./db/postgres.js");
    const repository = await createPostgresRepository({
      connectionString: config.databaseUrl,
      ssl: config.dbSsl,
    });

    if (config.autoMigrate) {
      await repository.migrate();
    }

    return {
      config,
      repository,
      service: createService({
        repository,
        tokenSecret: config.tokenSecret,
        publicUrl: config.publicUrl,
      }),
    };
  }

  const repository = createMemoryStore();
  return {
    config,
    repository,
    service: createService({
      repository,
      tokenSecret: config.tokenSecret,
      publicUrl: config.publicUrl,
    }),
  };
}

async function routeRequest(service, method, url, body, authorization) {
  const { pathname, searchParams } = url;
  const accessToken = parseBearerToken(authorization);

  if (method === "POST" && pathname === "/api/users") return await service.registerUser(validateRegistrationInput(body));
  if (method === "POST" && pathname === "/api/auth/tokens") return await service.login(validateLoginInput(body));
  if (method === "POST" && pathname === "/api/auth/token-refreshes") return await service.refreshTokens(validateRefreshTokenInput(body));
  if (method === "GET" && pathname === "/api/chats/active") return await service.getActiveChat(accessToken);
  if (method === "POST" && pathname === "/api/chats") return await service.createChat(accessToken);
  if (method === "POST" && pathname === "/api/chat-participants") return await service.joinChat(accessToken, validateInviteCodeInput(body));
  if (method === "GET" && pathname.startsWith("/api/chats/") && pathname.endsWith("/messages")) {
    return await service.listMessages(accessToken, {
      ...validateMessageListQuery({
        chat_id: Number(pathname.split("/")[3]),
        after_message_id: searchParams.get("after_message_id") ? Number(searchParams.get("after_message_id")) : undefined,
        limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
      }),
    });
  }
  if (method === "POST" && pathname === "/api/media-upload-intents") return await service.createMediaUploadIntent(accessToken, validateMediaUploadIntentInput(body));
  if (method === "POST" && pathname === "/api/messages") return await service.sendMessage(accessToken, validateSendMessageInput(body));
  if (method === "POST" && pathname === "/api/media-accesses") return await service.accessMedia(accessToken, validateMediaAccessInput(body));
  if (method === "POST" && pathname === "/api/chat-reset-logs") return await service.resetChat(accessToken, validateChatIdInput(body));
  if (method === "POST" && pathname === "/api/chat-terminations") return await service.leaveChat(accessToken, validateChatIdInput(body));

  throw createAppError(ERROR_CODES.NOT_FOUND, "Not found");
}

function parseBearerToken(header) {
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  return scheme === "Bearer" ? token : null;
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    validateRequestBody(parsed);
    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw createAppError(ERROR_CODES.REQUEST_VALIDATION_FAILED, "요청 본문 형식이 올바르지 않습니다.");
    }
    throw error;
  }
}

function sendJson(res, statusCode, value) {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value));
}

function sendError(res, error) {
  const statusCode = error?.code ? mapAppErrorToHttpStatus(error.code) : 500;
  sendJson(res, statusCode, serializeErrorResponse(error));
}

function logRuntimeConfig(config) {
  console.log(
    "[startup-config]",
    JSON.stringify(
      {
        port: config.port,
        dbProvider: config.dbProvider,
        databaseUrl: maskDatabaseUrl(config.databaseUrl),
        dbSsl: config.dbSsl,
        dbAutoMigrate: config.autoMigrate,
        storageBaseUrl: config.publicUrl,
        tokenSecret: config.tokenSecret ? "[redacted]" : null,
      },
      null,
      2,
    ),
  );
}

function maskDatabaseUrl(databaseUrl) {
  if (!databaseUrl) return null;
  try {
    const url = new URL(databaseUrl);
    if (url.password) {
      url.password = "***";
    }
    return url.toString();
  } catch {
    return "[invalid]";
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
