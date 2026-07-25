export type MediaPath = {storage_path: string};

/** Signs every path before atomically consuming a limited media view. */
export async function grantMediaAccess(
  messageId: number,
  prepare: (messageId: number) => Promise<MediaPath[]>,
  sign: (path: string) => Promise<string>,
  consume: (messageId: number) => Promise<void>,
): Promise<string[]> {
  const media = await prepare(messageId);
  const signedUrls = await Promise.all(
    media.map(({storage_path: path}) => sign(path)),
  );
  await consume(messageId);
  return signedUrls;
}
