import { ERROR_CODES } from "./constants.js";

/**
 * Structured application error that carries a specification error code.
 */
export class AppError extends Error {
  constructor(code, message, retryable = false) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.retryable = retryable;
  }
}

/**
 * Creates a typed application error from a known code.
 *
 * @param {keyof typeof ERROR_CODES} code
 * @param {string} message
 * @param {boolean} [retryable=false]
 * @returns {AppError}
 */
export function createAppError(code, message, retryable = false) {
  return new AppError(code, message, retryable);
}
