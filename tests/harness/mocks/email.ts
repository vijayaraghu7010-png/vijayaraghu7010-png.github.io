/* No message leaves a test. Every one is recorded instead, so a test
   can ask what would have been sent - and, more usefully, assert that
   a code or a token never appears where it should not. */

const g: any = globalThis as any;
g.__sent = g.__sent || [];

export const sent = () => (g.__sent ||= []);
export function resetEmail() { g.__sent = []; }

export function emailConfigured(): boolean { return g.__emailConfigured ?? false; }
export function setEmailConfigured(on: boolean) { g.__emailConfigured = on; }

export async function sendEmail(message: any) {
  sent().push(message);
  if (!emailConfigured()) {
    return { delivered: false, provider: 'none', reason: 'no email provider is configured', retryable: true };
  }
  return { delivered: true, provider: 'test' };
}

export function trackingCodeMessage(to: string, orderCode: string, code: string, key: string) {
  return { to, subject: `code for ${orderCode}`, text: `Your code is ${code}.`, idempotency_key: key };
}
export function trackingLinkMessage(to: string, orderCode: string, url: string, key: string) {
  return { to, subject: `follow ${orderCode}`, text: url, idempotency_key: key };
}
