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

   There are two kinds of message here and they are allowed different
   things, because they are sent to addresses that were trusted in
   different ways.

   A LOOKUP message - a tracking code, a tracking link - goes to an
   address somebody typed into a form. That person has not proved they
   are the customer, so the message may say only that an order exists,
   its code, and a short-lived way to look at it. Never a price, never
   an address, never a photograph.

   An ORDER message - a confirmation, a status change - goes to the
   address on the order itself, which the customer gave at checkout.
   Telling them what they just bought and what it cost is the point of
   it. Still never a photograph, never a phone number or a postal
   address, and never anything about an order that is not theirs. */

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  /* Optional, and always alongside the text - never instead of it.
     A mail client that will not render HTML still has the whole
     message. */
  html?: string;
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

  if (provider === 'resend') {
    /* Imported here rather than at the top so that a shop with no
       provider never loads one. */
    const { sendViaResend } = await import('./resend.ts');
    return await sendViaResend(message);
  }

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

/* ---------------------------------------------------- order messages

   These go to the address on the order, so they may name what was
   bought and what it came to. The shaping is deliberate: a line is a
   name and a count, never a photograph and never a configuration -
   "9 x Polaroid Prints (Medium)" tells the customer what they bought
   without reprinting the message they wrote inside a card. */

export type OrderLine = { product_name: string; quantity: number };

const rupees = (paise: number) =>
  `₹${(Math.round(Number(paise) || 0) / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })}`;

const listLines = (lines: OrderLine[]) =>
  lines.map((l) => `  ${l.quantity} x ${l.product_name}`).join('\n');

export function orderPlacedMessage(
  to: string,
  orderCode: string,
  lines: OrderLine[],
  totals: {
    subtotal_paise: number;
    discount_paise: number;
    shipping_paise?: number;
    total_paise: number;
  },
  trackUrl: string,
  key: string
): EmailMessage {
  const shipping = Number(totals.shipping_paise) || 0;
  const charged = shipping > 0;

  /* Each line is named only when there is one. "Discount ₹0" invites
     the question of why not, and "Shipping ₹0" on a shop that settles
     delivery separately is just noise. */
  const money = [
    totals.discount_paise > 0 || charged ? `Subtotal: ${rupees(totals.subtotal_paise)}` : null,
    totals.discount_paise > 0 ? `Discount: -${rupees(totals.discount_paise)}` : null,
    charged ? `Shipping: ${rupees(shipping)}` : null,
    `Total: ${rupees(totals.total_paise)}`
  ]
    .filter(Boolean)
    .join('\n');

  return {
    to,
    subject: `We have your order ${orderCode}`,
    text:
      `Thank you - your order is with us.\n\n` +
      `Order ${orderCode}\n\n` +
      `${listLines(lines)}\n\n` +
      `${money}\n\n` +
      /* Only promise a separate conversation about shipping when
         there is going to be one. An order that has already paid for
         delivery should not be told to expect a bill for it. */
      (charged
        ? ''
        : `Shipping is worked out separately and confirmed with you before ` +
          `anything is sent.\n\n`) +
      `You can follow it here:\n${trackUrl}\n\n` +
      `We will write again when it moves along.\n\n` +
      `WrappedStudio\n`,
    idempotency_key: key
  };
}

/* To the studio, not to a customer. It may therefore name the
   customer - this is the shop's own post about its own order - but it
   still carries no address, no telephone number and no photograph.
   Those are in the panel, behind a sign-in, which is where they
   belong. */
export function studioAlertMessage(
  to: string,
  orderCode: string,
  customerName: string,
  lines: OrderLine[],
  totalPaise: number,
  key: string
): EmailMessage {
  return {
    to,
    subject: `New order ${orderCode} - ${rupees(totalPaise)}`,
    text:
      `${customerName} has placed order ${orderCode}.\n\n` +
      `${listLines(lines)}\n\n` +
      `Total: ${rupees(totalPaise)}\n\n` +
      `The delivery details and any photographs are on the order in the ` +
      `panel.\n`,
    idempotency_key: key
  };
}

/* What each status is called when a customer is told about it. The
   panel's own words, so the two never disagree. */
const STATUS_SAID: Record<string, { subject: string; line: string }> = {
  paid: {
    subject: 'Payment received',
    line: 'Your payment has come through, and your order is in the queue to be made.'
  },
  in_progress: {
    subject: 'Being made',
    line: 'Your order is being made now.'
  },
  completed: {
    subject: 'On its way',
    line: 'Your order is finished and on its way to you.'
  },
  cancelled: {
    subject: 'Cancelled',
    line: 'Your order has been cancelled. If that is a surprise, please reply and we will put it right.'
  }
};

export function orderStatusMessage(
  to: string,
  orderCode: string,
  status: string,
  trackUrl: string,
  key: string
): EmailMessage | null {
  const said = STATUS_SAID[status];
  /* A status nobody has written a sentence for is not announced.
     Silence is better than a customer being emailed the word
     "pending". */
  if (!said) return null;

  return {
    to,
    subject: `${said.subject} - order ${orderCode}`,
    text: `${said.line}\n\nOrder ${orderCode}\n\n${trackUrl}\n\nWrappedStudio\n`,
    idempotency_key: key
  };
}

/* A payment has just been submitted, and nobody has looked at it yet.

   Two messages, because the two readers need opposite things. The
   customer needs to know the money is not lost and that a person will
   look at it - the worst moment in a manual UPI flow is paying and
   then hearing nothing. The studio needs to know there is something
   waiting, because until somebody opens the panel the order does not
   move at all.

   The customer's wording is deliberately not "Payment received": that
   is what the shop says once a payment has been *confirmed*, and the
   two must not sound the same. */
export function paymentSubmittedMessage(
  to: string,
  orderCode: string,
  trackUrl: string,
  key: string
): EmailMessage {
  return {
    to,
    subject: `Payment details received - order ${orderCode}`,
    text:
      `Thank you - we have your payment details for order ${orderCode}.

` +
      `Somebody at the studio checks each payment by hand. You will get ` +
      `another message as soon as it is confirmed, and your order is not ` +
      `made until then.

` +
      `${trackUrl}

WrappedStudio
`,
    idempotency_key: key
  };
}

/* The studio's half: there is money to check. The reference number is
   not in here - it lives on the order in the panel, and an email is
   not the place for it. */
export function studioPaymentAlertMessage(
  to: string,
  orderCode: string,
  method: string,
  amountPaise: number,
  key: string
): EmailMessage {
  return {
    to,
    subject: `Payment to check - order ${orderCode} - ${rupees(amountPaise)}`,
    text:
      `A payment has been submitted for order ${orderCode}.

` +
      `Method: ${method}
` +
      `Amount: ${rupees(amountPaise)}

` +
      `The reference number and the screenshot are on the order in the ` +
      `panel. Nothing moves until somebody confirms it there.
`,
    idempotency_key: key
  };
}

/* The manual UPI flow. A refusal has to say what to do next, or it is
   just bad news with no door out of it. */
export function paymentMessage(
  to: string,
  orderCode: string,
  outcome: 'confirmed' | 'rejected' | 'correction',
  trackUrl: string,
  key: string
): EmailMessage {
  const said =
    outcome === 'confirmed'
      ? {
          subject: `Payment confirmed - order ${orderCode}`,
          body: `We have checked your payment for order ${orderCode} and it is confirmed. Your order is in the queue to be made.`
        }
      : outcome === 'rejected'
        ? {
            subject: `We could not confirm your payment - order ${orderCode}`,
            body:
              `We could not match a payment to order ${orderCode}.\n\n` +
              `Nothing has been taken by us. If you have paid, reply to this ` +
              `message and we will look again.`
          }
        : {
            subject: `Your payment needs a correction - order ${orderCode}`,
            body:
              `There is something to fix with the payment for order ${orderCode}.\n\n` +
              `Open the order below and send the details again.`
          };

  return {
    to,
    subject: said.subject,
    text: `${said.body}\n\n${trackUrl}\n\nWrappedStudio\n`,
    idempotency_key: key
  };
}

/* The studio, told that a customer's photographs have arrived.

   This goes to the people who print, not to the customer, so it says
   what is needed to get on with it: which order, how many pictures,
   and a link that fetches them.

   The link is a credential and the mail says so. It is good for
   fourteen days and reaches that one order's photographs - nothing
   else, and no part of the panel. */
export function studioPhotosMessage(
  to: string,
  orderCode: string,
  count: number,
  downloadUrl: string,
  panelUrl: string,
  key: string
): EmailMessage {
  return {
    to,
    subject: `Photographs in for ${orderCode} (${count})`,
    text:
      `${count} photograph${count === 1 ? '' : 's'} have come in for order ${orderCode}.\n\n` +
      `Download them as one zip:\n${downloadUrl}\n\n` +
      `That link works for fourteen days and fetches this order's ` +
      `photographs and nothing else. Anyone who has it can use it, so ` +
      `treat it like the pictures themselves.\n\n` +
      `Or open the order in the panel:\n${panelUrl}\n\n` +
      `WrappedStudio\n`,
    idempotency_key: key
  };
}
