import fs from "node:fs";
import path from "node:path";

/**
 * Loads environment variables from a local .env file when present.
 *
 * @param {string} [filePath]
 * @returns {Record<string, string>}
 */
export function loadDotEnv(filePath = path.resolve(process.cwd(), ".env")) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const parsed = {};
  const contents = fs.readFileSync(filePath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) continue;

    const key = trimmed.slice(0, equalsIndex).trim();
    const value = trimmed.slice(equalsIndex + 1).trim();
    if (!key) continue;

    const unquoted = value.startsWith('"') && value.endsWith('"')
      ? value.slice(1, -1)
      : value.startsWith("'") && value.endsWith("'")
        ? value.slice(1, -1)
        : value;

    if (process.env[key] === undefined) {
      process.env[key] = unquoted;
    }
    parsed[key] = process.env[key] ?? unquoted;
  }

  return parsed;
}

/**
 * Resolves application configuration from environment variables.
 *
 * @returns {object}
 */
export function getAppConfig() {
  loadDotEnv();

  return {
    port: Number(process.env.PORT ?? 3000),
    tokenSecret: process.env.TOKEN_SECRET ?? "dulman-secret",
    publicUrl: process.env.STORAGE_BASE_URL ?? "https://storage.local",
    databaseUrl: process.env.DATABASE_URL ?? null,
    dbProvider: process.env.DB_PROVIDER ?? (process.env.DATABASE_URL ? "postgres" : "memory"),
    dbSsl: parseBoolean(process.env.DB_SSL ?? "false"),
    autoMigrate: parseBoolean(process.env.DB_AUTO_MIGRATE ?? "true"),
    s3: {
      bucket: process.env.AWS_S3_BUCKET ?? null,
      prefix: process.env.AWS_S3_PREFIX ?? "media",
      region: process.env.AWS_REGION ?? "ap-northeast-2",
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? null,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? null,
    },
  };
}

function parseBoolean(value) {
  return value === "1" || value === "true" || value === "yes";
}
