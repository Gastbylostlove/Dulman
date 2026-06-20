import assert from "node:assert/strict";
import test from "node:test";
import { ERROR_CODES } from "../src/constants.js";
import { mapAppErrorToHttpStatus, serializeErrorResponse } from "../src/http-errors.js";

test("maps app errors to stable HTTP statuses", () => {
  assert.equal(mapAppErrorToHttpStatus(ERROR_CODES.REQUEST_VALIDATION_FAILED), 400);
  assert.equal(mapAppErrorToHttpStatus(ERROR_CODES.AUTH_SESSION_EXPIRED), 401);
  assert.equal(mapAppErrorToHttpStatus(ERROR_CODES.AUTH_DEVICE_REPLACED), 401);
  assert.equal(mapAppErrorToHttpStatus(ERROR_CODES.CHAT_PARTICIPANT_REQUIRED), 403);
  assert.equal(mapAppErrorToHttpStatus(ERROR_CODES.CHAT_NOT_FOUND), 404);
  assert.equal(mapAppErrorToHttpStatus(ERROR_CODES.CHAT_ACTIVE_EXISTS), 409);
  assert.equal(mapAppErrorToHttpStatus(ERROR_CODES.AUTH_RATE_LIMITED), 429);
  assert.equal(mapAppErrorToHttpStatus(ERROR_CODES.CHAT_INVITE_RATE_LIMITED), 429);
  assert.equal(mapAppErrorToHttpStatus(ERROR_CODES.NOT_FOUND), 404);
  assert.equal(mapAppErrorToHttpStatus("UNKNOWN_CODE"), 500);
});

test("serializes error responses with retryable flag", () => {
  assert.deepEqual(serializeErrorResponse({ code: "X", message: "oops", retryable: true }), {
    error: {
      code: "X",
      message: "oops",
      retryable: true,
    },
  });
});
