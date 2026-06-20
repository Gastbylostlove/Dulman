import { ERROR_CODES } from "./constants.js";

const HTTP_STATUS_BY_CODE = Object.freeze({
  [ERROR_CODES.AUTH_LOGIN_ID_DUPLICATED]: 409,
  [ERROR_CODES.AUTH_INVALID_CREDENTIALS]: 401,
  [ERROR_CODES.AUTH_RATE_LIMITED]: 429,
  [ERROR_CODES.AUTH_SESSION_EXPIRED]: 401,
  [ERROR_CODES.AUTH_DEVICE_REPLACED]: 401,
  [ERROR_CODES.CHAT_ACTIVE_EXISTS]: 409,
  [ERROR_CODES.CHAT_INVITE_NOT_FOUND]: 404,
  [ERROR_CODES.CHAT_INVITE_RATE_LIMITED]: 429,
  [ERROR_CODES.CHAT_FULL]: 409,
  [ERROR_CODES.CHAT_CREATE_FAILED]: 500,
  [ERROR_CODES.CHAT_JOIN_FAILED]: 500,
  [ERROR_CODES.CHAT_NOT_FOUND]: 404,
  [ERROR_CODES.CHAT_NOT_ACTIVE]: 409,
  [ERROR_CODES.CHAT_PARTICIPANT_REQUIRED]: 403,
  [ERROR_CODES.MESSAGE_EMPTY]: 400,
  [ERROR_CODES.MESSAGE_SEND_FAILED]: 500,
  [ERROR_CODES.MEDIA_LIMIT_EXCEEDED]: 413,
  [ERROR_CODES.MEDIA_UPLOAD_FAILED]: 502,
  [ERROR_CODES.MEDIA_VIEW_LIMIT_EXCEEDED]: 403,
  [ERROR_CODES.MEDIA_VIEW_COUNT_UPDATE_FAILED]: 500,
  [ERROR_CODES.MEDIA_URL_ISSUE_FAILED]: 502,
  [ERROR_CODES.CHAT_RESET_FAILED]: 500,
  [ERROR_CODES.CHAT_LEAVE_FAILED]: 500,
  [ERROR_CODES.REQUEST_VALIDATION_FAILED]: 400,
  [ERROR_CODES.NOT_FOUND]: 404,
});

/**
 * Maps a specification error code to an HTTP status code.
 *
 * @param {string} code
 * @returns {number}
 */
export function mapAppErrorToHttpStatus(code) {
  return HTTP_STATUS_BY_CODE[code] ?? 500;
}

/**
 * Serializes an error response body expected by the API.
 *
 * @param {{ code?: string, message?: string, retryable?: boolean }} error
 * @returns {{ error: { code: string, message: string, retryable: boolean } }}
 */
export function serializeErrorResponse(error) {
  return {
    error: {
      code: error?.code ?? "INTERNAL_ERROR",
      message: error?.message ?? "Internal server error",
      retryable: Boolean(error?.retryable),
    },
  };
}
