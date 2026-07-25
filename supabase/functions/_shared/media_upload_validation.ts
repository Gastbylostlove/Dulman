export type MediaFileDeclaration = {
  mime_type: string;
  byte_size: number;
};

const maxFiles = 10;
const maxTotalBytes = 500 * 1024 * 1024;
const maxBytesByMime: Record<string, number> = {
  'image/jpeg': 20 * 1024 * 1024,
  'image/png': 20 * 1024 * 1024,
  'image/gif': 20 * 1024 * 1024,
  'image/webp': 20 * 1024 * 1024,
  'video/mp4': 200 * 1024 * 1024,
};

/** Validates untrusted media declarations before an upload token is issued. */
export function validateMediaFiles(value: unknown): MediaFileDeclaration[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > maxFiles) {
    throw new Error('MEDIA_INVALID');
  }

  let totalBytes = 0;
  const files = value.map((item) => {
    if (typeof item !== 'object' || item === null) throw new Error('MEDIA_INVALID');
    const {mime_type: mimeType, byte_size: byteSize} = item as Record<string, unknown>;
    const maxBytes = typeof mimeType === 'string' ? maxBytesByMime[mimeType] : null;
    if (
      maxBytes == null ||
      !Number.isSafeInteger(byteSize) ||
      (byteSize as number) <= 0 ||
      (byteSize as number) > maxBytes
    ) {
      throw new Error('MEDIA_INVALID');
    }
    totalBytes += byteSize as number;
    return {mime_type: mimeType as string, byte_size: byteSize as number};
  });

  if (totalBytes > maxTotalBytes) throw new Error('MEDIA_INVALID');
  return files;
}
