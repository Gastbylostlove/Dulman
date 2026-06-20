import crypto from "node:crypto";

/**
 * Hashes a string with SHA-256.
 *
 * @param {string} value
 * @returns {string}
 */
export function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/**
 * Hashes a password using scrypt.
 *
 * @param {string} password
 * @param {string} [salt]
 * @returns {string}
 */
export function hashPassword(password, salt = "dulman-password-salt") {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

/**
 * Generates a random device identifier.
 *
 * @returns {string}
 */
export function createDeviceId() {
  return crypto.randomUUID();
}

/**
 * Generates a refresh token.
 *
 * @returns {string}
 */
export function createRefreshToken() {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * Signs a compact token payload.
 *
 * @param {object} payload
 * @param {string} secret
 * @returns {string}
 */
export function createAccessToken(payload, secret) {
  const header = base64urlJson({ alg: "HS256", typ: "JWT" });
  const body = base64urlJson(payload);
  const signature = sign(`${header}.${body}`, secret);
  return `${header}.${body}.${signature}`;
}

/**
 * Verifies a compact token and returns its payload.
 *
 * @param {string} token
 * @param {string} secret
 * @returns {object}
 */
export function verifyAccessToken(token, secret) {
  const [header, body, signature] = token.split(".");
  if (!header || !body || !signature) {
    throw new Error("Invalid token format");
  }

  const expected = sign(`${header}.${body}`, secret);
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (
    expectedBuffer.length !== signatureBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
  ) {
    throw new Error("Invalid token signature");
  }

  return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
}

function base64urlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function sign(value, secret) {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}
