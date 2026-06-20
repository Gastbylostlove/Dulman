import { CHAT_STATUS, ERROR_CODES, MEDIA_LIMITS, MESSAGE_TYPES, PERMISSION_TYPES, RATE_LIMITS } from "./constants.js";
import { createAppError } from "./errors.js";
import { createAccessToken, createRefreshToken, hashPassword, sha256, verifyAccessToken } from "./security.js";
import { randomUUID } from "node:crypto";

/**
 * Creates the application service layer.
 *
 * @param {object} options
 * @param {object} [options.repository]
 * @param {object} [options.store]
 * @param {() => Date} [options.now]
 * @param {string} [options.tokenSecret]
 * @param {string} [options.publicUrl]
 * @returns {object}
 */
export function createService({
  repository,
  store,
  now = () => new Date(),
  tokenSecret = "dulman-secret",
  publicUrl = "https://storage.local",
} = {}) {
  const repo = repository ?? store;
  if (!repo) throw new Error("repository is required");

  return {
    registerUser: (input) => registerUser(repo, input, now),
    login: (input) => login(repo, input, now, tokenSecret),
    refreshTokens: (input) => refreshTokens(repo, input, tokenSecret),
    getActiveChat: (accessToken) => getActiveChat(repo, accessToken, tokenSecret),
    createChat: (accessToken) => createChat(repo, accessToken, now, tokenSecret),
    joinChat: (accessToken, input) => joinChat(repo, accessToken, input, now, tokenSecret),
    listMessages: (accessToken, input) => listMessages(repo, accessToken, input, tokenSecret),
    createMediaUploadIntent: (accessToken, input) => createMediaUploadIntent(repo, accessToken, input, publicUrl, tokenSecret),
    sendMessage: (accessToken, input) => sendMessage(repo, accessToken, input, now, tokenSecret),
    accessMedia: (accessToken, input) => accessMedia(repo, accessToken, input, tokenSecret),
    resetChat: (accessToken, input) => resetChat(repo, accessToken, input, now, tokenSecret),
    leaveChat: (accessToken, input) => leaveChat(repo, accessToken, input, now, tokenSecret),
    verifyAccessToken: (token) => verifyAccessToken(token, tokenSecret),
  };
}

async function registerUser(repo, input, now) {
  const { login_id: loginId, password } = input;
  if (await repo.findUser(loginId)) {
    throw createAppError(ERROR_CODES.AUTH_LOGIN_ID_DUPLICATED, "이미 사용 중인 login_id입니다.");
  }

  const createdAt = now().toISOString();
  await repo.insertUser({
    login_id: loginId,
    password_hash: hashPassword(password),
    current_device_id: null,
    current_refresh_token: null,
    created_at: createdAt,
  });

  return {
    login_id: loginId,
    created_at: createdAt,
  };
}

async function login(repo, input, now, tokenSecret) {
  const { login_id: loginId, password, device_id: deviceId } = input;
  const limiter = getFailureLimiter(repo.authFailures, loginId, now);
  if (limiter.blocked) {
    throw createAppError(ERROR_CODES.AUTH_RATE_LIMITED, "로그인 실패 제한 중입니다.");
  }

  const user = await repo.findUser(loginId);
  if (!user || user.password_hash !== hashPassword(password)) {
    limiter.recordFailure();
    throw createAppError(ERROR_CODES.AUTH_INVALID_CREDENTIALS, "로그인 정보가 올바르지 않습니다.");
  }

  limiter.clear();
  const refreshToken = createRefreshToken();
  await repo.updateUser(loginId, {
    current_device_id: deviceId,
    current_refresh_token: sha256(refreshToken),
  });

  const accessToken = createAccessToken(
    { login_id: loginId, device_id: deviceId },
    tokenSecret,
  );

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    login_id: loginId,
    current_device_id: deviceId,
    active_chat_id: await findActiveChatId(repo, loginId),
  };
}

async function refreshTokens(repo, input, tokenSecret) {
  const { login_id: loginId, refresh_token: refreshToken, device_id: deviceId } = input;
  const user = await requireUser(repo, loginId);
  if (user.current_device_id !== deviceId) {
    throw createAppError(ERROR_CODES.AUTH_DEVICE_REPLACED, "다른 기기에서 로그인되었습니다.");
  }

  if (user.current_refresh_token !== sha256(refreshToken)) {
    throw createAppError(ERROR_CODES.AUTH_SESSION_EXPIRED, "세션이 만료되었습니다.");
  }

  return {
    access_token: createAccessToken(
      { login_id: loginId, device_id: deviceId },
      tokenSecret,
    ),
    login_id: loginId,
    current_device_id: deviceId,
  };
}

async function getActiveChat(repo, accessToken, tokenSecret) {
  const account = await authenticate(repo, accessToken, tokenSecret);
  const chat = await repo.findActiveChatByParticipant(account.login_id);
  if (!chat) {
    return {
      active_chat_id: null,
      status: null,
      user_a_id: null,
      user_b_id: null,
      last_reset_at: null,
    };
  }

  return {
    active_chat_id: chat.id,
    status: chat.status,
    user_a_id: chat.user_a_id,
    user_b_id: chat.user_b_id,
    last_reset_at: chat.last_reset_at,
  };
}

async function createChat(repo, accessToken, now, tokenSecret) {
  return withTransaction(repo, async (tx) => {
    const account = await authenticate(tx, accessToken, tokenSecret);
    if (await tx.findActiveChatByParticipant(account.login_id)) {
      throw createAppError(ERROR_CODES.CHAT_ACTIVE_EXISTS, "이미 활성 채팅방이 있습니다.");
    }

    const chat = await tx.insertChat({
      user_a_id: account.login_id,
      user_b_id: null,
      status: CHAT_STATUS.WAITING,
      invite_code: createInviteCode(),
      last_reset_at: null,
      created_at: now().toISOString(),
      ended_at: null,
      ended_by_user_id: null,
    });
    if (!chat) {
      throw createAppError(ERROR_CODES.CHAT_CREATE_FAILED, "채팅방 생성에 실패했습니다.");
    }

    return {
      chat_id: chat.id,
      status: chat.status,
      user_a_id: chat.user_a_id,
      user_b_id: chat.user_b_id,
      invite_code: chat.invite_code,
      created_at: chat.created_at,
    };
  });
}

async function joinChat(repo, accessToken, input, now, tokenSecret) {
  return withTransaction(repo, async (tx) => {
    const account = await authenticate(tx, accessToken, tokenSecret);
    const limiter = getFailureLimiter(tx.inviteFailures, account.login_id, now);
    if (limiter.blocked) {
      throw createAppError(ERROR_CODES.CHAT_INVITE_RATE_LIMITED, "초대코드 입력이 제한되었습니다.");
    }

    const chat = await tx.findChatByInviteCode(input.invite_code);
    if (!chat) {
      limiter.recordFailure();
      throw createAppError(ERROR_CODES.CHAT_INVITE_NOT_FOUND, "초대코드를 찾을 수 없습니다.");
    }

    if (await tx.findActiveChatByParticipant(account.login_id)) {
      throw createAppError(ERROR_CODES.CHAT_ACTIVE_EXISTS, "이미 활성 채팅방이 있습니다.");
    }

    if (chat.status === CHAT_STATUS.ENDED) {
      throw createAppError(ERROR_CODES.CHAT_NOT_ACTIVE, "종료된 채팅방입니다.");
    }

    if (chat.user_b_id || chat.status === CHAT_STATUS.ACTIVE || chat.user_a_id === account.login_id) {
      throw createAppError(ERROR_CODES.CHAT_FULL, "채팅방 정원이 가득 찼습니다.");
    }

    const updated = await tx.updateChat(chat.id, {
      user_b_id: account.login_id,
      status: CHAT_STATUS.ACTIVE,
    });
    if (!updated) {
      throw createAppError(ERROR_CODES.CHAT_JOIN_FAILED, "채팅방 입장에 실패했습니다.");
    }
    limiter.clear();

    return {
      chat_id: updated.id,
      status: updated.status,
      user_a_id: updated.user_a_id,
      user_b_id: updated.user_b_id,
    };
  });
}

async function listMessages(repo, accessToken, input, tokenSecret) {
  const account = await authenticate(repo, accessToken, tokenSecret);
  const chat = await requireChat(repo, input.chat_id);
  ensureParticipant(chat, account.login_id);
  ensureActive(chat);

  const afterMessageId = input.after_message_id ?? 0;
  const limit = input.limit ?? 50;

  const messages = await repo.listMessagesByChatId(chat.id);
  const mediaByMessageId = new Map();
  for (const message of messages) {
    mediaByMessageId.set(message.id, await repo.listMediaByMessageId(message.id));
  }

  return {
    chat_id: chat.id,
    last_reset_at: chat.last_reset_at,
    messages: messages
      .filter((message) => message.id > afterMessageId)
      .filter((message) => {
        if (!chat.last_reset_at) return true;
        return new Date(message.created_at).getTime() > new Date(chat.last_reset_at).getTime();
      })
      .sort((a, b) => a.id - b.id)
      .slice(0, limit)
      .map((message) => ({
        id: message.id,
        sender_id: message.sender_id,
        type: message.type,
        text_content: message.text_content,
        permission_type: message.permission_type,
        view_count: message.view_count,
        media: (mediaByMessageId.get(message.id) ?? [])
          .sort((a, b) => a.id - b.id)
          .map((media) => ({
            media_id: media.id,
            url: media.url,
            mime_type: media.mime_type,
            created_at: media.created_at,
          })),
        created_at: message.created_at,
      })),
  };
}

async function createMediaUploadIntent(repo, accessToken, input, publicUrl, tokenSecret) {
  const account = await authenticate(repo, accessToken, tokenSecret);
  const chat = await requireChat(repo, input.chat_id);
  ensureParticipant(chat, account.login_id);
  ensureActive(chat);

  const files = input.files ?? [];
  validateMediaBatch(files);

  return {
    upload_items: files.map((file) => ({
      client_file_id: file.client_file_id,
      upload_url: `${publicUrl}/uploads/${chat.id}/${file.client_file_id}`,
      media_url: `${publicUrl}/media/${chat.id}/${file.client_file_id}`,
      mime_type: file.mime_type,
    })),
  };
}

async function sendMessage(repo, accessToken, input, now, tokenSecret) {
  return withTransaction(repo, async (tx) => {
    const account = await authenticate(tx, accessToken, tokenSecret);
    const chat = await requireChat(tx, input.chat_id);
    ensureParticipant(chat, account.login_id);
    ensureActive(chat);

    const isText = input.type === MESSAGE_TYPES.TEXT;
    const isMedia = input.type === MESSAGE_TYPES.MEDIA;
    if (!isText && !isMedia) {
      throw createAppError(ERROR_CODES.MESSAGE_EMPTY, "메시지 형식이 올바르지 않습니다.");
    }

    if (isText) {
      if (!input.text_content) {
        throw createAppError(ERROR_CODES.MESSAGE_EMPTY, "텍스트 내용이 없습니다.");
      }

      const message = await tx.insertMessage({
        chat_id: chat.id,
        sender_id: account.login_id,
        type: MESSAGE_TYPES.TEXT,
        text_content: input.text_content,
        permission_type: null,
        view_count: 0,
        created_at: now().toISOString(),
      });
      if (!message) {
        throw createAppError(ERROR_CODES.MESSAGE_SEND_FAILED, "메시지 전송에 실패했습니다.");
      }

      return {
        message_id: message.id,
        chat_id: chat.id,
        sender_id: account.login_id,
        type: message.type,
        permission_type: null,
        created_at: message.created_at,
      };
    }

    if (!input.permission_type || !Array.isArray(input.media_items) || input.media_items.length === 0) {
      throw createAppError(ERROR_CODES.MESSAGE_EMPTY, "미디어 내용이 없습니다.");
    }

    const message = await tx.insertMessage({
      chat_id: chat.id,
      sender_id: account.login_id,
      type: MESSAGE_TYPES.MEDIA,
      text_content: input.text_content ?? null,
      permission_type: input.permission_type,
      view_count: 0,
      created_at: now().toISOString(),
    });
    if (!message) {
      throw createAppError(ERROR_CODES.MESSAGE_SEND_FAILED, "메시지 전송에 실패했습니다.");
    }

    for (const item of input.media_items) {
      await tx.insertMedia({
        message_id: message.id,
        url: item.url,
        mime_type: item.mime_type,
        created_at: message.created_at,
      });
    }

    return {
      message_id: message.id,
      chat_id: chat.id,
      sender_id: account.login_id,
      type: message.type,
      permission_type: message.permission_type,
      created_at: message.created_at,
    };
  });
}

async function accessMedia(repo, accessToken, input, tokenSecret) {
  return withTransaction(repo, async (tx) => {
    const account = await authenticate(tx, accessToken, tokenSecret);
    const message = await tx.findMessageById(input.message_id);
    if (!message) {
      throw createAppError(ERROR_CODES.CHAT_NOT_FOUND, "미디어 메시지를 찾을 수 없습니다.");
    }
    if (message.type !== MESSAGE_TYPES.MEDIA) {
      throw createAppError(ERROR_CODES.MEDIA_VIEW_LIMIT_EXCEEDED, "미디어 메시지가 아닙니다.");
    }

    const chat = await requireChat(tx, message.chat_id);
    ensureParticipant(chat, account.login_id);
    ensureActive(chat);

    const allowedViews = allowedMediaViews(message.permission_type);
    if (message.view_count >= allowedViews) {
      throw createAppError(ERROR_CODES.MEDIA_VIEW_LIMIT_EXCEEDED, "열람 횟수를 초과했습니다.");
    }

    const nextViewCount = message.view_count + 1;
    const updated = await tx.updateMessage(message.id, {
      view_count: nextViewCount,
    });
    if (!updated) {
      throw createAppError(ERROR_CODES.MEDIA_VIEW_COUNT_UPDATE_FAILED, "열람 횟수 갱신에 실패했습니다.");
    }

    const media = await tx.listMediaByMessageId(message.id);
    return {
      message_id: message.id,
      view_count: nextViewCount,
      media: media
        .sort((a, b) => a.id - b.id)
        .map((item) => ({
          media_id: item.id,
          url: item.url,
          mime_type: item.mime_type,
        })),
    };
  });
}

async function resetChat(repo, accessToken, input, now, tokenSecret) {
  return withTransaction(repo, async (tx) => {
    const account = await authenticate(tx, accessToken, tokenSecret);
    const chat = await requireChat(tx, input.chat_id);
    ensureParticipant(chat, account.login_id);

    const resetAt = now().toISOString();
    const resetLog = await tx.insertResetLog({
      chat_id: chat.id,
      reset_by_user_id: account.login_id,
      reset_at: resetAt,
    });
    if (!resetLog) {
      throw createAppError(ERROR_CODES.CHAT_RESET_FAILED, "채팅 리셋에 실패했습니다.");
    }

    const updated = await tx.updateChat(chat.id, {
      last_reset_at: resetAt,
    });
    if (!updated) {
      throw createAppError(ERROR_CODES.CHAT_RESET_FAILED, "채팅 리셋에 실패했습니다.");
    }

    return {
      chat_id: chat.id,
      reset_log_id: resetLog.id,
      last_reset_at: resetAt,
    };
  });
}

async function leaveChat(repo, accessToken, input, now, tokenSecret) {
  return withTransaction(repo, async (tx) => {
    const account = await authenticate(tx, accessToken, tokenSecret);
    const chat = await requireChat(tx, input.chat_id);
    ensureParticipant(chat, account.login_id);

    const endedAt = now().toISOString();
    const updated = await tx.updateChat(chat.id, {
      status: CHAT_STATUS.ENDED,
      ended_at: endedAt,
      ended_by_user_id: account.login_id,
    });
    if (!updated) {
      throw createAppError(ERROR_CODES.CHAT_LEAVE_FAILED, "채팅 종료에 실패했습니다.");
    }

    return {
      chat_id: updated.id,
      status: updated.status,
      ended_at: updated.ended_at,
      ended_by_user_id: updated.ended_by_user_id,
    };
  });
}

async function authenticate(repo, accessToken, tokenSecret) {
  if (!accessToken) {
    throw createAppError(ERROR_CODES.AUTH_SESSION_EXPIRED, "세션이 만료되었습니다.");
  }

  let payload;
  try {
    payload = verifyAccessToken(accessToken, tokenSecret);
  } catch {
    throw createAppError(ERROR_CODES.AUTH_SESSION_EXPIRED, "세션이 만료되었습니다.");
  }
  const loginId = payload.login_id ?? payload.sub;
  const user = await repo.findUser(loginId);
  if (!user) {
    throw createAppError(ERROR_CODES.AUTH_SESSION_EXPIRED, "세션이 만료되었습니다.");
  }
  if (user.current_device_id !== payload.device_id) {
    throw createAppError(ERROR_CODES.AUTH_DEVICE_REPLACED, "다른 기기에서 로그인되었습니다.");
  }
  return { login_id: loginId, device_id: payload.device_id };
}

async function withTransaction(repo, work) {
  if (typeof repo.withTransaction === "function") {
    return repo.withTransaction(work);
  }

  return work(repo);
}

async function requireUser(repo, loginId) {
  const user = await repo.findUser(loginId);
  if (!user) {
    throw createAppError(ERROR_CODES.AUTH_SESSION_EXPIRED, "계정을 찾을 수 없습니다.");
  }
  return user;
}

async function requireChat(repo, chatId) {
  const chat = await repo.findChatById(chatId);
  if (!chat) {
    throw createAppError(ERROR_CODES.CHAT_NOT_FOUND, "채팅방을 찾을 수 없습니다.");
  }
  return chat;
}

function ensureParticipant(chat, loginId) {
  if (chat.user_a_id !== loginId && chat.user_b_id !== loginId) {
    throw createAppError(ERROR_CODES.CHAT_PARTICIPANT_REQUIRED, "채팅방 참여자가 아닙니다.");
  }
}

function ensureActive(chat) {
  if (chat.status !== CHAT_STATUS.ACTIVE) {
    throw createAppError(ERROR_CODES.CHAT_NOT_ACTIVE, "활성 채팅방이 아닙니다.");
  }
}

async function findActiveChatId(repo, loginId) {
  const chat = await repo.findActiveChatByParticipant(loginId);
  return chat ? chat.id : null;
}

function allowedMediaViews(permissionType) {
  if (permissionType === PERMISSION_TYPES.ONCE) return 1;
  if (permissionType === PERMISSION_TYPES.REPLAY_ONCE) return 2;
  return Number.POSITIVE_INFINITY;
}

function validateMediaBatch(files) {
  let photoCount = 0;
  let videoCount = 0;
  let totalBytes = 0;

  for (const file of files) {
    totalBytes += file.byte_size;
    if (totalBytes > MEDIA_LIMITS.MAX_TOTAL_BYTES_PER_SEND) {
      throw createAppError(ERROR_CODES.MEDIA_LIMIT_EXCEEDED, "전송 가능한 용량을 초과했습니다.");
    }

    if (file.mime_type.startsWith("image/")) {
      photoCount += 1;
      if (photoCount > MEDIA_LIMITS.MAX_PHOTOS_PER_SEND || file.byte_size > MEDIA_LIMITS.MAX_PHOTO_BYTES) {
        throw createAppError(ERROR_CODES.MEDIA_LIMIT_EXCEEDED, "사진 전송 제한을 초과했습니다.");
      }
    }

    if (file.mime_type.startsWith("video/")) {
      videoCount += 1;
      if (videoCount > MEDIA_LIMITS.MAX_VIDEOS_PER_SEND || file.byte_size > MEDIA_LIMITS.MAX_VIDEO_BYTES) {
        throw createAppError(ERROR_CODES.MEDIA_LIMIT_EXCEEDED, "영상 전송 제한을 초과했습니다.");
      }
    }
  }
}

function createInviteCode() {
  return `INV-${randomUUID().replace(/-/g, "").slice(0, 24).toUpperCase()}`;
}

function getFailureLimiter(bucket, key, now) {
  const entry = bucket.get(key) ?? { count: 0, blockedUntil: 0 };
  const currentTime = now().getTime();
  if (entry.blockedUntil && entry.blockedUntil > currentTime) {
    bucket.set(key, entry);
    return {
      blocked: true,
      recordFailure() {},
      clear() {},
    };
  }

  return {
    blocked: false,
    recordFailure() {
      if (entry.blockedUntil && entry.blockedUntil <= currentTime) {
        entry.count = 0;
        entry.blockedUntil = 0;
      }
      entry.count += 1;
      if (entry.count >= RATE_LIMITS.MAX_FAILURES) {
        entry.blockedUntil = currentTime + RATE_LIMITS.BLOCK_MS;
      }
      bucket.set(key, entry);
    },
    clear() {
      bucket.delete(key);
    },
  };
}
