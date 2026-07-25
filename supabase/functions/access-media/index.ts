import {
  grantMediaAccess,
  type MediaPath,
} from '../_shared/access_media_flow.ts';

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

  const callRpc = async (functionName: string) => {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${functionName}`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        authorization,
        'content-type': 'application/json',
      },
      body: JSON.stringify({p_message_id: messageId}),
    });
    if (!response.ok) throw new ResponseError(response);
    return response;
  };

  const sign = async (path: string) => {
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
  };

  try {
    const signedUrls = await grantMediaAccess(
      messageId,
      async () => {
        const response = await callRpc('prepare_media_access');
        const {media} = await response.json();
        return media as MediaPath[];
      },
      sign,
      async () => { await callRpc('access_media'); },
    );

    return json({signed_urls: signedUrls});
  } catch (error) {
    if (error instanceof ResponseError) {
      return new Response(error.response.body, {
        status: error.response.status,
        headers: {'content-type': 'application/json'},
      });
    }
    return json({error: 'MEDIA_SIGN_FAILED'}, 502);
  }
});

class ResponseError extends Error {
  constructor(readonly response: Response) {
    super('RPC_FAILED');
  }
}
