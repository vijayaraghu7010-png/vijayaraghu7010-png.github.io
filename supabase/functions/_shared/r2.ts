/* Talking to the private bucket.

   R2 speaks S3, so everything here is AWS Signature Version 4. There is
   no SDK: the three things the studio needs - hand out a URL that lets
   one browser put one object, ask whether an object arrived, remove an
   object - are a few dozen lines each, and a dependency that large
   would have to be audited to be trusted with these credentials.

   The credentials live in the function's environment and are read at
   call time. They are never returned to a caller, never logged, and
   never reach a browser: what a browser receives is a presigned URL,
   which is good for one key, one method, and fifteen minutes.      */

const enc = new TextEncoder();

function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`missing ${name}`);
  return v;
}

export function r2Configured(): boolean {
  return Boolean(
    Deno.env.get('R2_ACCOUNT_ID') &&
      Deno.env.get('R2_ACCESS_KEY_ID') &&
      Deno.env.get('R2_SECRET_ACCESS_KEY') &&
      Deno.env.get('R2_BUCKET')
  );
}

function host(): string {
  const custom = Deno.env.get('R2_ENDPOINT');
  if (custom) return new URL(custom).host;
  return `${env('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`;
}

async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === 'string' ? enc.encode(data) : data;
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return hex(new Uint8Array(digest));
}

function hex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmac(key: Uint8Array, msg: string): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign'
  ]);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(msg)));
}

async function signingKey(secret: string, date: string, region: string): Promise<Uint8Array> {
  const kDate = await hmac(enc.encode(`AWS4${secret}`), date);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, 's3');
  return await hmac(kService, 'aws4_request');
}

/* Every segment of a key is escaped, but the slashes between them are
   not: a key is a path, and S3 wants it signed as one. */
function encodeKey(key: string): string {
  return key
    .split('/')
    .map((part) => encodeURIComponent(part).replace(/[!'()*]/g, (c) =>
      `%${c.charCodeAt(0).toString(16).toUpperCase()}`
    ))
    .join('/');
}

function stamps() {
  const now = new Date();
  const amz = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return { amzDate: amz, dateStamp: amz.slice(0, 8) };
}

/* A URL that lets whoever holds it PUT exactly this object, with
   exactly this content type, until it expires. */
export async function presignPut(
  key: string,
  contentType: string,
  expiresSeconds = 900
): Promise<string> {
  const region = 'auto';
  const accessKey = env('R2_ACCESS_KEY_ID');
  const secret = env('R2_SECRET_ACCESS_KEY');
  const bucket = env('R2_BUCKET');
  const h = host();
  const { amzDate, dateStamp } = stamps();
  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const canonicalUri = `/${bucket}/${encodeKey(key)}`;

  /* The content type is signed as a header, so a browser cannot take a
     URL issued for a JPEG and put something else there. */
  const signedHeaders = 'content-type;host';
  const params = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${accessKey}/${scope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresSeconds),
    'X-Amz-SignedHeaders': signedHeaders
  });
  params.sort();

  const canonicalRequest = [
    'PUT',
    canonicalUri,
    params.toString(),
    `content-type:${contentType}\nhost:${h}\n`,
    signedHeaders,
    'UNSIGNED-PAYLOAD'
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    await sha256Hex(canonicalRequest)
  ].join('\n');

  const sig = hex(await hmac(await signingKey(secret, dateStamp, region), stringToSign));
  return `https://${h}${canonicalUri}?${params.toString()}&X-Amz-Signature=${sig}`;
}

/* A URL that lets whoever holds it read exactly this object, under the
   name the customer gave it, for five minutes.

   The filename travels in response-content-disposition, which is part
   of what is signed: it cannot be edited in the address bar without
   voiding the signature. It is also what makes the browser save the
   file rather than display it, and why the studio gets back
   "wedding-03.jpg" instead of a UUID.

   Five minutes rather than fifteen. A download is a deliberate click
   and happens at once, so there is no reason to leave the door open
   for the quarter of an hour an upload might need.                 */
export async function presignGet(
  key: string,
  filename: string,
  expiresSeconds = 300
): Promise<string> {
  const region = 'auto';
  const accessKey = env('R2_ACCESS_KEY_ID');
  const secret = env('R2_SECRET_ACCESS_KEY');
  const bucket = env('R2_BUCKET');
  const h = host();
  const { amzDate, dateStamp } = stamps();
  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const canonicalUri = `/${bucket}/${encodeKey(key)}`;

  /* A GET carries no body and no content type, so the host is the
     only header there is to bind the signature to. */
  const signedHeaders = 'host';
  const query = canonicalQuery({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${accessKey}/${scope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresSeconds),
    'X-Amz-SignedHeaders': signedHeaders,
    'response-content-disposition': `attachment; filename="${safeFilename(filename)}"`
  });

  const canonicalRequest = [
    'GET',
    canonicalUri,
    query,
    `host:${h}\n`,
    signedHeaders,
    'UNSIGNED-PAYLOAD'
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    await sha256Hex(canonicalRequest)
  ].join('\n');

  const sig = hex(await hmac(await signingKey(secret, dateStamp, region), stringToSign));
  return `https://${h}${canonicalUri}?${query}&X-Amz-Signature=${sig}`;
}

/* The query string a signature is computed over, built by hand.

   URLSearchParams would be the obvious thing to use and is the wrong
   thing: it encodes a space as "+", because that is what an HTML form
   does. SigV4 wants RFC 3986, where a space is %20. Nothing noticed
   while the only signed parameters were dates and numbers; a filename
   has spaces in it, and R2 then computes a signature over the string
   it thinks it sees rather than the one we signed. The error it
   returns says the secret key is wrong, which it is not.

   Keys are sorted, each key and value escaped the same way, and the
   result is used both for signing and for the URL itself: if those
   two ever disagree the signature is void.                        */
function canonicalQuery(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .map((k) => `${rfc3986(k)}=${rfc3986(params[k])}`)
    .join('&');
}

/* encodeURIComponent is RFC 3986 apart from five characters it leaves
   alone that the standard says to escape. */
function rfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

/* The customer chose this name, so it is not to be trusted inside a
   header. Quotes would end the filename early, and a line break would
   end the header; a path separator would suggest a directory to
   whatever unpacks it. What is left is still recognisably their
   name. */
function safeFilename(name: string): string {
  const cleaned = String(name || 'photograph')
    .replace(/[\r\n"\\]/g, '')
    .replace(/[/\\]/g, '-')
    .trim();
  return (cleaned || 'photograph').slice(0, 200);
}

/* A signed request the function itself makes. */
async function signedFetch(method: 'HEAD' | 'DELETE' | 'GET', key: string): Promise<Response> {
  const region = 'auto';
  const accessKey = env('R2_ACCESS_KEY_ID');
  const secret = env('R2_SECRET_ACCESS_KEY');
  const bucket = env('R2_BUCKET');
  const h = host();
  const { amzDate, dateStamp } = stamps();
  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const canonicalUri = `/${bucket}/${encodeKey(key)}`;
  const payloadHash = await sha256Hex('');

  const canonicalRequest = [
    method,
    canonicalUri,
    '',
    `host:${h}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`,
    'host;x-amz-content-sha256;x-amz-date',
    payloadHash
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    await sha256Hex(canonicalRequest)
  ].join('\n');

  const sig = hex(await hmac(await signingKey(secret, dateStamp, region), stringToSign));

  return await fetch(`https://${h}${canonicalUri}`, {
    method,
    headers: {
      host: h,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      Authorization:
        `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, ` +
        `SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=${sig}`
    }
  });
}

/* What the bucket holds for this key, or null if it holds nothing. The
   size is what makes a completed upload believable: a row claiming four
   megabytes against a forty-byte object is not a finished upload. */
export async function headObject(
  key: string
): Promise<{ size: number; contentType: string | null } | null> {
  const res = await signedFetch('HEAD', key);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HEAD ${res.status}`);
  return {
    size: Number(res.headers.get('content-length') || 0),
    contentType: res.headers.get('content-type')
  };
}

/* S3 treats deleting something that is not there as success, and so do
   we: the point is that the object is gone, not who removed it. */
export async function deleteObject(key: string): Promise<void> {
  const res = await signedFetch('DELETE', key);
  if (!res.ok && res.status !== 404) {
    throw new Error(`DELETE ${res.status} ${await res.text()}`);
  }
}
