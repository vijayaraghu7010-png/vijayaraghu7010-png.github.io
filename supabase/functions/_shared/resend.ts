/* Resend, as one provider behind the email boundary.

   Nothing else in the shop knows this file exists. email.ts decides
   which provider to call and what a message may contain; this only
   knows how to hand one to Resend and how to read the answer.

   It never throws. A studio whose post has stopped is a studio with
   an inbox to check, not a shop that cannot take an order - so every
   failure comes back as a reason, and the caller carries on.

   Set with:
     supabase secrets set EMAIL_PROVIDER=resend
     supabase secrets set RESEND_API_KEY=re_...
     supabase secrets set EMAIL_FROM="WrappedStudio <orders@wrappedstudio.in>"

   The From address must be on a domain verified in Resend, or every
   send is refused with a 403 and the reason says so.               */

import type { EmailMessage, EmailResult } from './email.ts';

const ENDPOINT = 'https://api.resend.com/emails';

/* Resend's own default, usable before a domain verifies. It can only
   send to the address that owns the Resend account, which is enough
   to prove the wiring and no use to a customer. */
const FALLBACK_FROM = 'WrappedStudio <onboarding@resend.dev>';

export async function sendViaResend(message: EmailMessage): Promise<EmailResult> {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) {
    return {
      delivered: false,
      provider: 'resend',
      reason: 'RESEND_API_KEY is not set',
      retryable: true
    };
  }

  const from = Deno.env.get('EMAIL_FROM') || FALLBACK_FROM;
  const replyTo = Deno.env.get('EMAIL_REPLY_TO');

  /* Resend holds the key for 24 hours and returns the first result
     for a repeat, which is what makes a retry safe: a customer who
     asks twice for the same code is sent one message, not two. */
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    'Idempotency-Key': message.idempotency_key
  };

  const body: Record<string, unknown> = {
    from,
    to: [message.to],
    subject: message.subject,
    text: message.text
  };
  if (message.html) body.html = message.html;
  if (replyTo) body.reply_to = replyTo;

  let res: Response;
  try {
    res = await fetch(ENDPOINT, { method: 'POST', headers, body: JSON.stringify(body) });
  } catch {
    /* The network, not the message. Worth trying again. */
    return { delivered: false, provider: 'resend', reason: 'could not reach Resend', retryable: true };
  }

  if (res.ok) return { delivered: true, provider: 'resend' };

  /* Why it was refused, in Resend's words where it gave any - but
     never the address, the subject or the body, which is the rule
     everything on this side of the boundary keeps. */
  let detail = '';
  try {
    const payload = await res.json();
    detail = typeof payload?.message === 'string' ? payload.message : '';
  } catch {
    /* an unreadable body is described by the status alone */
  }

  /* 429 is a rate limit and 5xx is theirs; both are worth retrying.
     401 and 403 are the key or the From domain, and retrying those
     just repeats the same mistake more often. */
  const retryable = res.status === 429 || res.status >= 500;

  return {
    delivered: false,
    provider: 'resend',
    reason: detail ? `${res.status}: ${detail}` : `Resend refused the message (${res.status})`,
    retryable
  };
}
