/* Somewhere for a message to go, once anybody decides where.

   No provider has been chosen, so none is written here. What exists
   is the shape of the call and an honest answer when there is nothing
   to call: delivered false, and a reason saying so. Nothing pretends.

   The caller's job is to carry on regardless. A tracking code that
   could not be sent must not become an error that tells a stranger
   whether an order exists, and must not leave the customer's own
   request half-done. So this never throws; it reports.

   When a provider is chosen, it arrives as one more branch in send()
   and one more module beside this one. Nothing else moves.

   What may go in a message: that an order exists, its code, and a
   short-lived way to look at it. What may not: an address, a phone
   number, a price, a photograph, or anything about another order. */

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  /* Letting the same request be retried without sending twice. The
     provider is asked to treat two messages with one key as one. */
  idempotency_key: string;
};

export type EmailResult = {
  delivered: boolean;
  provider: string;
  /* Only ever a reason, never the message, the address or the code. */
  reason?: string;
  retryable?: boolean;
};

/* Which provider to use. Unset means none, which is the state today
   and the state these functions are written to survive. */
function providerName(): string {
  return (Deno.env.get('EMAIL_PROVIDER') || 'none').toLowerCase();
}

export function emailConfigured(): boolean {
  return providerName() !== 'none';
}

/* In development, seeing that a message would have gone, and what it
   said, is worth more than silence. It is never the default, and it
   writes no address. */
function logProvider(message: EmailMessage): EmailResult {
  console.log(`[email:log] would send "${message.subject}" (key ${message.idempotency_key})`);
  return { delivered: false, provider: 'log', reason: 'logged, not sent' };
}

export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const provider = providerName();

  if (provider === 'log') return logProvider(message);

  if (provider === 'none') {
    return {
      delivered: false,
      provider: 'none',
      reason: 'no email provider is configured',
      retryable: true
    };
  }

  /* A provider was named that nobody has written. Say so rather than
     failing in some quieter way. */
  return {
    delivered: false,
    provider,
    reason: `email provider "${provider}" is named but not implemented`,
    retryable: false
  };
}

/* The two messages this phase needs, kept here so their wording is in
   one place and so neither can grow a field it should not carry. */
export function trackingCodeMessage(to: string, orderCode: string, code: string, key: string): EmailMessage {
  return {
    to,
    subject: `Your WrappedStudio code for order ${orderCode}`,
    text:
      `Someone asked to see the progress of order ${orderCode}.\n\n` +
      `Your code is ${code}. It is good for ten minutes and can be used once.\n\n` +
      `If this was not you, you can ignore this message - the code on its own ` +
      `shows only whether the order has been made yet.\n`,
    idempotency_key: key
  };
}

export function trackingLinkMessage(to: string, orderCode: string, url: string, key: string): EmailMessage {
  return {
    to,
    subject: `Following your WrappedStudio order ${orderCode}`,
    text:
      `You can follow order ${orderCode} here:\n\n${url}\n\n` +
      `The link is private - anybody who has it can see this order's progress, ` +
      `so please keep it to yourself.\n`,
    idempotency_key: key
  };
}
