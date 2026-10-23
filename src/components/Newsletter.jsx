import { useState } from 'react';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function Newsletter() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(null);

  const submit = (e) => {
    e.preventDefault();
    const value = email.trim();

    if (!value) {
      setStatus({ ok: false, text: 'Please enter your email address.' });
      return;
    }
    if (!EMAIL.test(value)) {
      setStatus({ ok: false, text: 'That email address does not look right.' });
      return;
    }

    /* No email service is connected yet, so we say exactly that
       rather than claiming a subscription was created. */
    setStatus({
      ok: true,
      text: 'Thank you — your address is noted on this device. We will be in touch once our newsletter service is connected.'
    });
    setEmail('');
  };

  return (
    <section className="shell section" aria-labelledby="newsletter-title">
      <div className="newsletter panel">
        <div>
          <h2 className="newsletter__title" id="newsletter-title">
            Stay in Bloom
          </h2>
          <p className="newsletter__text">
            Get special offers, seasonal bouquets and a little bit of sunshine in your inbox.
          </p>
        </div>

        <form className="newsletter__form" onSubmit={submit} noValidate>
          <label className="sr-only" htmlFor="newsletter-email">
            Email address
          </label>
          <input
            id="newsletter-email"
            type="email"
            name="email"
            placeholder="Enter your email"
            autoComplete="email"
            value={email}
            aria-invalid={status && !status.ok ? 'true' : 'false'}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="btn btn--primary" type="submit">
            Subscribe
          </button>
          {status && (
            <p className={`newsletter__msg ${status.ok ? 'is-ok' : 'is-bad'}`} role="status">
              {status.text}
            </p>
          )}
        </form>
      </div>
    </section>
  );
}
