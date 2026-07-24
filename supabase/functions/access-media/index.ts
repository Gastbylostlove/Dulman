const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {'content-type': 'application/json'},
  });

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({error: 'METHOD_NOT_ALLOWED'}, 405);

  const authorization = request.headers.get('authorization');
  if (!authorization) return json({error: 'AUTH_REQUIRED'}, 401);

  const {message_id: messageId} = await request.json();
  if (!Number.isSafeInteger(messageId)) return json({error: 'MESSAGE_INVALID'}, 400);

  const accessResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/access_media`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      authorization,
      'content-type': 'application/json',
    },
    body: JSON.stringify({p_message_id: messageId}),
  });
  if (!accessResponse.ok) {
    return new Response(accessResponse.body, {
      status: accessResponse.status,
      headers: {'content-type': 'application/json'},
    });
  }

  const {media} = await accessResponse.json();
  const signedUrls = await Promise.all(media.map(async ({storage_path: path}: {storage_path: string}) => {
    const encodedPath = path.split('/').map(encodeURIComponent).join('/');
    const response = await fetch(
      `${supabaseUrl}/storage/v1/object/sign/media/${encodedPath}`,
      {
        method: 'POST',
        headers: {
          apikey: serviceRoleKey,
          authorization: `Bearer ${serviceRoleKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({expiresIn: 60}),
      },
    );
    if (!response.ok) throw new Error('MEDIA_SIGN_FAILED');
    const data = await response.json();
    return `${supabaseUrl}/storage/v1${data.signedURL}`;
  }));

  return json({signed_urls: signedUrls});
});
