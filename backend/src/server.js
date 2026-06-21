import http from "node:http";
import { getAppConfig } from "./config/env.js";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
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

const MIME_EXT = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "video/mp4": "mp4",
};

function mimeFromFilename(filename) {
  const ext = filename.split(".").pop()?.toLowerCase();
  const found = Object.entries(MIME_EXT).find(([, e]) => e === ext);
  return found ? found[0] : "application/octet-stream";
}

function createS3Client(s3Config) {
  return new S3Client({
    region: s3Config.region,
    credentials: {
      accessKeyId: s3Config.accessKeyId,
      secretAccessKey: s3Config.secretAccessKey,
    },
  });
}

let runtimePromise = null;

/**
 * Starts the HTTP server with the repository selected from local env config.
 *
 * @returns {Promise<http.Server>}
 */
export async function startServer() {
  const runtime = await getRuntime();
  const s3 = createS3Client(runtime.config.s3);
  logRuntimeConfig(runtime.config);
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    const clientIp = req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "?";
    const sw = Date.now();

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      // APK 다운로드: GET /dulman.apk
      if (req.method === "GET" && url.pathname === "/dulman.apk") {
        const { promises: fs } = await import("node:fs");
        const { default: path } = await import("node:path");
        const apkPath = path.join(process.cwd(), "dulman.apk");
        try {
          const bytes = await fs.readFile(apkPath);
          res.writeHead(200, {
            "Content-Type": "application/vnd.android.package-archive",
            "Content-Disposition": "attachment; filename=dulman.apk",
            "Content-Length": bytes.byteLength,
          });
          res.end(bytes);
        } catch {
          res.writeHead(404); res.end();
        }
        return;
      }

      // 파일 업로드: PUT /uploads/:chatId/:fileId → S3
      if (req.method === "PUT" && url.pathname.startsWith("/uploads/")) {
        const parts = url.pathname.split("/").filter(Boolean);
        if (parts.length >= 3) {
          const chatId = parts[1];
          const fileId = parts[2];
          const s3Key = `${runtime.config.s3.prefix}/${chatId}/${fileId}`;
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          const buf = Buffer.concat(chunks);
          const mime = req.headers["content-type"] ?? mimeFromFilename(fileId);
          await s3.send(new PutObjectCommand({
            Bucket: runtime.config.s3.bucket,
            Key: s3Key,
            Body: buf,
            ContentType: mime,
          }));
          const ms = Date.now() - sw;
          console.log(`[UPLOAD] PUT /uploads/${chatId}/${fileId}  ${buf.byteLength}bytes  ${ms}ms  s3=${s3Key}  from=${clientIp}`);
          sendJson(res, 200, { ok: true });
          return;
        }
      }

      // 파일 서빙: GET /media/:chatId/:fileId ← S3
      if (req.method === "GET" && url.pathname.startsWith("/media/")) {
        const parts = url.pathname.split("/").filter(Boolean);
        if (parts.length >= 3) {
          const chatId = parts[1];
          const fileId = parts[2];
          const s3Key = `${runtime.config.s3.prefix}/${chatId}/${fileId}`;
          try {
            const s3Res = await s3.send(new GetObjectCommand({
              Bucket: runtime.config.s3.bucket,
              Key: s3Key,
            }));
            const chunks = [];
            for await (const chunk of s3Res.Body) chunks.push(chunk);
            const bytes = Buffer.concat(chunks);
            const mime = s3Res.ContentType ?? mimeFromFilename(fileId);
            const ms = Date.now() - sw;
            console.log(`[MEDIA]  GET /media/${chatId}/${fileId}  ${bytes.byteLength}bytes  ${ms}ms  s3=${s3Key}  from=${clientIp}`);
            res.writeHead(200, { "Content-Type": mime });
            res.end(bytes);
          } catch (e) {
            const ms = Date.now() - sw;
            console.warn(`[MEDIA]  GET /media/${chatId}/${fileId}  404  ${ms}ms  s3=${s3Key}  from=${clientIp}  err=${e.Code ?? e.message}`);
            res.writeHead(404);
            res.end();
          }
          return;
        }
      }

      const body = await readJsonBody(req);
      const result = await routeRequest(runtime.service, req.method ?? "GET", url, body, req.headers.authorization);
      const ms = Date.now() - sw;
      console.log(`[REQ]    ${req.method} ${url.pathname}  200  ${ms}ms  from=${clientIp}`);
      sendJson(res, 200, result);
    } catch (error) {
      const ms = Date.now() - sw;
      const statusCode = error?.code ? mapAppErrorToHttpStatus(error.code) : 500;
      if (statusCode >= 500) {
        console.error(`[ERR]    ${req.method} ${url.pathname}  ${statusCode}  ${ms}ms  from=${clientIp}`, error);
      } else {
        console.warn(`[ERR]    ${req.method} ${url.pathname}  ${statusCode}  ${ms}ms  [${error?.code}] ${error?.message}`);
      }
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
