import { ERROR_CODES, MESSAGE_TYPES, PERMISSION_TYPES } from "./constants.js";
import { createAppError } from "./errors.js";

/**
 * Validates and normalizes request payloads for the HTTP boundary.
 */
export function validateRegistrationInput(input) {
  return {
    login_id: requireString(input, "login_id"),
    password: requireString(input, "password"),
  };
}

export function validateLoginInput(input) {
  return {
    login_id: requireString(input, "login_id"),
    password: requireString(input, "password"),
    device_id: requireString(input, "device_id"),
  };
}

export function validateRefreshTokenInput(input) {
  return {
    login_id: requireString(input, "login_id"),
    refresh_token: requireString(input, "refresh_token"),
    device_id: requireString(input, "device_id"),
  };
}

export function validateChatIdInput(input) {
  return {
    chat_id: requirePositiveInteger(input, "chat_id"),
  };
}

export function validateInviteCodeInput(input) {
  return {
    invite_code: requireString(input, "invite_code"),
  };
}

export function validateMessageListQuery(query) {
  return {
    chat_id: requirePositiveInteger(query, "chat_id"),
    after_message_id: optionalPositiveInteger(query, "after_message_id"),
    limit: optionalPositiveInteger(query, "limit"),
  };
}

export function validateMediaUploadIntentInput(input) {
  const files = requireArray(input, "files");
  return {
    chat_id: requirePositiveInteger(input, "chat_id"),
    files: files.map(validateMediaFile),
  };
}

export function validateSendMessageInput(input) {
  const type = requireEnum(input, "type", [MESSAGE_TYPES.TEXT, MESSAGE_TYPES.MEDIA]);
  const base = {
    chat_id: requirePositiveInteger(input, "chat_id"),
    type,
    text_content: optionalString(input, "text_content"),
  };

  if (type === MESSAGE_TYPES.MEDIA) {
    return {
      ...base,
      permission_type: requireEnum(input, "permission_type", [
        PERMISSION_TYPES.ONCE,
        PERMISSION_TYPES.REPLAY_ONCE,
        PERMISSION_TYPES.KEEP,
      ]),
      media_items: requireArray(input, "media_items").map(validateMediaItem),
    };
  }

  return base;
}

export function validateMediaAccessInput(input) {
  return {
    message_id: requirePositiveInteger(input, "message_id"),
  };
}

export function validateRequestBody(input) {
  if (!isPlainObject(input)) {
    throw createAppError(ERROR_CODES.REQUEST_VALIDATION_FAILED, "요청 본문 형식이 올바르지 않습니다.");
  }
}

function validateMediaFile(file) {
  validateObject(file, "files item");
  return {
    client_file_id: requireString(file, "client_file_id"),
    mime_type: requireString(file, "mime_type"),
    byte_size: requireNonNegativeInteger(file, "byte_size"),
  };
}

function validateMediaItem(item) {
  validateObject(item, "media_items item");
  return {
    url: requireString(item, "url"),
    mime_type: requireString(item, "mime_type"),
  };
}

function requireString(input, key) {
  const value = input?.[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw createAppError(ERROR_CODES.REQUEST_VALIDATION_FAILED, `${key} 값이 필요합니다.`);
  }
  return value;
}

function optionalString(input, key) {
  const value = input?.[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw createAppError(ERROR_CODES.REQUEST_VALIDATION_FAILED, `${key} 값 형식이 올바르지 않습니다.`);
  }
  return value;
}

function requirePositiveInteger(input, key) {
  const value = input?.[key];
  if (!Number.isInteger(value) || value <= 0) {
    throw createAppError(ERROR_CODES.REQUEST_VALIDATION_FAILED, `${key} 값이 필요합니다.`);
  }
  return value;
}

function optionalPositiveInteger(input, key) {
  const value = input?.[key];
  if (value === undefined || value === null || value === "") return undefined;
  if (!Number.isInteger(value) || value <= 0) {
    throw createAppError(ERROR_CODES.REQUEST_VALIDATION_FAILED, `${key} 값 형식이 올바르지 않습니다.`);
  }
  return value;
}

function requireNonNegativeInteger(input, key) {
  const value = input?.[key];
  if (!Number.isInteger(value) || value < 0) {
    throw createAppError(ERROR_CODES.REQUEST_VALIDATION_FAILED, `${key} 값 형식이 올바르지 않습니다.`);
  }
  return value;
}

function requireArray(input, key) {
  const value = input?.[key];
  if (!Array.isArray(value) || value.length === 0) {
    throw createAppError(ERROR_CODES.REQUEST_VALIDATION_FAILED, `${key} 값이 필요합니다.`);
  }
  return value;
}

function requireEnum(input, key, values) {
  const value = requireString(input, key);
  if (!values.includes(value)) {
    throw createAppError(ERROR_CODES.REQUEST_VALIDATION_FAILED, `${key} 값 형식이 올바르지 않습니다.`);
  }
  return value;
}

function validateObject(value, label) {
  if (!isPlainObject(value)) {
    throw createAppError(ERROR_CODES.REQUEST_VALIDATION_FAILED, `${label} 형식이 올바르지 않습니다.`);
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
