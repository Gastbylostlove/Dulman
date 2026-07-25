import {
  validateMediaFiles,
} from '../_shared/media_upload_validation.ts';

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

  try {
    const body = await request.json();
    const chatId = body?.chat_id;
    if (!Number.isSafeInteger(chatId)) return json({error: 'MEDIA_INVALID'}, 400);
    const files = validateMediaFiles(body?.files);

    const authorizeResponse = await fetch(
      `${supabaseUrl}/rest/v1/rpc/authorize_media_upload`,
      {
        method: 'POST',
        headers: {
          apikey: anonKey,
          authorization,
          'content-type': 'application/json',
        },
        body: JSON.stringify({p_chat_id: chatId, p_files: files}),
      },
    );
    if (!authorizeResponse.ok) {
      return new Response(authorizeResponse.body, {
        status: authorizeResponse.status,
        headers: {'content-type': 'application/json'},
      });
    }

    const intents = await authorizeResponse.json();
    const uploadItems = await Promise.all(intents.map(async (
      intent: {storage_path: string; mime_type: string},
    ) => {
      const path = intent.storage_path;
      const encodedPath = path.split('/').map(encodeURIComponent).join('/');
      const response = await fetch(
        `${supabaseUrl}/storage/v1/object/upload/sign/media/${encodedPath}`,
        {
          method: 'POST',
          headers: {
            apikey: serviceRoleKey,
            authorization: `Bearer ${serviceRoleKey}`,
            'content-type': 'application/json',
          },
          body: '{}',
        },
      );
      if (!response.ok) throw new Error('MEDIA_UPLOAD_SIGN_FAILED');
      const data = await response.json();
      const token = new URL(data.url, supabaseUrl).searchParams.get('token');
      if (!token) throw new Error('MEDIA_UPLOAD_SIGN_FAILED');
      return {
        upload_url: path,
        upload_token: token,
        media_url: path,
        mime_type: intent.mime_type,
      };
    }));

    return json({upload_items: uploadItems});
  } catch (error) {
    const code = error instanceof Error ? error.message : 'MEDIA_UPLOAD_SIGN_FAILED';
    return json({error: code}, code === 'MEDIA_INVALID' ? 400 : 502);
  }
});
