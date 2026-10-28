import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/* The filename a customer chose is put inside an HTTP header, which is
   the one place in the download path where their text leaves the
   database. A quote would end the filename early and let the rest be
   read as further header parameters; a newline would end the header
   altogether. Neither is exotic - a file can be named almost anything
   on a phone - so the rule is checked here rather than trusted.

   The function lives in Deno code the node runner cannot import, so it
   is lifted out of the source and run on its own. That keeps the test
   honest about which implementation it is checking: if the source
   changes shape, this fails rather than quietly testing a copy. */

const source = readFileSync(
  new URL('../supabase/functions/_shared/r2.ts', import.meta.url),
  'utf8'
);

const match = source.match(/function safeFilename\(name: string\): string \{([\s\S]*?)\n\}/);
assert.ok(match, 'safeFilename should still exist in _shared/r2.ts');

const safeFilename = new Function('name', match[1].replace(/: string/g, ''));

test('a filename cannot break out of the header it is put in', () => {
  assert.ok(!safeFilename('holiday".jpg').includes('"'));
  assert.ok(!safeFilename('a\r\nX-Evil: yes.jpg').includes('\n'));
  assert.ok(!safeFilename('a\r\nX-Evil: yes.jpg').includes('\r'));
  assert.ok(!safeFilename('back\\slash.jpg').includes('\\'));
});

test('a filename cannot suggest a directory', () => {
  assert.ok(!safeFilename('../../etc/passwd').includes('/'));
  assert.equal(safeFilename('holiday/2026.jpg'), 'holiday-2026.jpg');
});

test('an ordinary name is left alone', () => {
  assert.equal(safeFilename('WhatsApp Image 2026-10-27 at 1.49.26 PM.jpeg'),
    'WhatsApp Image 2026-10-27 at 1.49.26 PM.jpeg');
  assert.equal(safeFilename('wedding-03.jpg'), 'wedding-03.jpg');
});

test('a name that is nothing at all still has one', () => {
  assert.equal(safeFilename(''), 'photograph');
  assert.equal(safeFilename('   '), 'photograph');
  assert.equal(safeFilename(null), 'photograph');
  assert.equal(safeFilename('"'), 'photograph');
});

test('a very long name is cut, not refused', () => {
  const long = 'a'.repeat(500) + '.jpg';
  assert.equal(safeFilename(long).length, 200);
});

/* The expiry is a security property, not a preference: it is the
   window in which a leaked URL is still worth something. */
test('a download URL is good for five minutes, not fifteen', () => {
  const fn = source.match(/export async function presignGet\([\s\S]*?expiresSeconds = (\d+)/);
  assert.ok(fn, 'presignGet should still exist');
  assert.equal(Number(fn[1]), 300);

  const put = source.match(/export async function presignPut\([\s\S]*?expiresSeconds = (\d+)/);
  assert.equal(Number(put[1]), 900, 'uploads keep their own, longer window');
});

/* The bug that got past the first round of tests, and the reason this
   one exists at all.

   URLSearchParams encodes a space as "+", because that is what an HTML
   form does. SigV4 wants RFC 3986, where a space is %20. Every signed
   parameter was a date or a number until a filename joined them, and a
   filename has spaces. R2 answered SignatureDoesNotMatch, which reads
   like a wrong secret key and is not. */

const canonicalQueryBlock = source.match(
  /function canonicalQuery\(params: Record<string, string>\): string \{([\s\S]*?)\n\}/
);
const rfc3986Block = source.match(/function rfc3986\(value: string\): string \{([\s\S]*?)\n\}/);
assert.ok(canonicalQueryBlock, 'canonicalQuery should exist in _shared/r2.ts');
assert.ok(rfc3986Block, 'rfc3986 should exist in _shared/r2.ts');

const rfc3986 = new Function('value', rfc3986Block[1].replace(/: string/g, ''));
const canonicalQuery = new Function(
  'params',
  'const rfc3986 = ' + rfc3986.toString() + ';' +
    canonicalQueryBlock[1].replace(/: Record<string, string>|: string/g, '')
);

test('a space is signed as %20 and never as a plus', () => {
  const q = canonicalQuery({ 'response-content-disposition': 'attachment; filename="a b.jpg"' });
  assert.ok(q.includes('%20'), 'a space should be percent-encoded');
  assert.ok(!q.includes('+'), 'a plus would void the signature');
});

test('the characters RFC 3986 reserves are escaped', () => {
  assert.equal(rfc3986("!'()*"), '%21%27%28%29%2A');
  assert.equal(rfc3986(' '), '%20');
  assert.equal(rfc3986('"'), '%22');
  assert.equal(rfc3986(';'), '%3B');
  assert.equal(rfc3986('/'), '%2F');
});

test('a real filename with spaces survives signing unchanged in meaning', () => {
  const name = 'WhatsApp Image 2026-10-27 at 1.49.26 PM.jpeg';
  const q = canonicalQuery({ 'response-content-disposition': `attachment; filename="${name}"` });
  assert.ok(!q.includes('+'));
  assert.equal(decodeURIComponent(q.split('=').slice(1).join('=')), `attachment; filename="${name}"`);
});

test('parameters are sorted, because the signature is computed in order', () => {
  const q = canonicalQuery({ 'X-Amz-Date': '2', 'X-Amz-Algorithm': '1', 'response-content-disposition': '3' });
  assert.equal(q, 'X-Amz-Algorithm=1&X-Amz-Date=2&response-content-disposition=3');
});

/* The query signed and the query sent must be the same string. */
test('presignGet signs and sends one query, not two', () => {
  const block = source.match(/export async function presignGet\([\s\S]*?\n\}/)[0];
  assert.ok(block.includes('const query = canonicalQuery({'));
  assert.ok(block.includes('?${query}&X-Amz-Signature='));
  assert.ok(!block.includes('params.toString()'), 'URLSearchParams must not reach a signed query');
});

/* A GET has no body and no content type. Signing one as though it did
   produces a URL R2 refuses, and the failure looks like a credential
   problem rather than a signing one, so it is worth pinning down. */
test('a download URL signs only the host', () => {
  const block = source.match(/export async function presignGet\([\s\S]*?\n\}/)[0];
  assert.ok(block.includes("const signedHeaders = 'host';"));
  assert.ok(!block.includes('content-type;host'));
  assert.ok(block.includes('response-content-disposition'));
});
