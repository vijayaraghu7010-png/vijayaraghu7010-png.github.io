import { useState } from 'react';
import { Check, Info } from 'lucide-react';

import PhotoUpload from '../components/PhotoUpload';
import usePageMeta from '../hooks/usePageMeta';
import { CONTACT } from '../data/categories';

const CATEGORIES = ['Magazine', 'Polaroids', 'Bouquet', 'A mix of things', 'Something else'];
const OCCASIONS = ['Birthday', 'Anniversary', 'Wedding', 'Farewell', 'Friendship', 'Just because', 'Other'];
const BUDGETS = ['Under ₹500', '₹500 – ₹1,000', '₹1,000 – ₹2,500', '₹2,500 – ₹5,000', 'Above ₹5,000'];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^\+?\d[\d\s-]{8,15}$/;

export default function CustomGifts() {
  usePageMeta(
    'Custom Gifts',
    'Tell us your idea and we will make something personal — custom magazines, polaroid sets and handmade bouquets.'
  );

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    category: CATEGORIES[0],
    occasion: OCCASIONS[0],
    budget: BUDGETS[1],
    description: '',
    date: ''
  });
  const [photos, setPhotos] = useState([]);
  const [errors, setErrors] = useState({});
  const [sent, setSent] = useState(null);

  const set = (key) => (e) => {
    const { value } = e.target;
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const onSubmit = (e) => {
    e.preventDefault();
    const next = {};

    if (!form.name.trim()) next.name = 'Please tell us your name.';
    if (!form.email.trim()) next.email = 'We need an email address to reply to.';
    else if (!EMAIL.test(form.email.trim())) next.email = 'That email address does not look right.';
    if (!form.phone.trim()) next.phone = 'A phone number helps us reach you quickly.';
    else if (!PHONE.test(form.phone.trim())) next.phone = 'Enter a valid phone number.';
    if (!form.description.trim()) next.description = 'Tell us a little about the gift you have in mind.';
    else if (form.description.trim().length < 20) next.description = 'A couple more details would help — 20 characters minimum.';
    if (form.date) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (new Date(form.date) < today) next.date = 'Pick a date in the future.';
    }

    setErrors(next);
    if (Object.keys(next).length) {
      setSent(null);
      return;
    }

    /* There is no backend yet, so the request is prepared here and the
       copy says plainly that nothing has been sent or stored for us. */
    setSent({
      at: new Date().toLocaleString('en-IN'),
      summary: `${form.category} · ${form.occasion} · ${form.budget}`,
      photos: photos.length
    });
  };

  const mailto = `mailto:${CONTACT.email}?subject=${encodeURIComponent(
    'Custom gift request'
  )}&body=${encodeURIComponent(
    [
      `Name: ${form.name}`,
      `Email: ${form.email}`,
      `Phone: ${form.phone}`,
      `Gift category: ${form.category}`,
      `Occasion: ${form.occasion}`,
      `Budget: ${form.budget}`,
      form.date ? `Preferred delivery date: ${form.date}` : null,
      photos.length ? `Reference images: ${photos.map((p) => p.name).join(', ')}` : null,
      '',
      form.description
    ]
      .filter(Boolean)
      .join('\n')
  )}`;

  return (
    <div className="shell">
      <header className="page-head">
        <p className="eyebrow">Have a special idea?</p>
        <h1 style={{ marginTop: 8 }}>Custom Gifts Made Just for You</h1>
        <p>Tell us your story and we&rsquo;ll create something truly personal.</p>
      </header>

      <div className="two-col">
        <form className="info-card" onSubmit={onSubmit} noValidate>
          <h3>Tell us about the gift</h3>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="cg-name">Your name</label>
              <input
                id="cg-name"
                type="text"
                autoComplete="name"
                value={form.name}
                aria-invalid={errors.name ? 'true' : 'false'}
                onChange={set('name')}
              />
              {errors.name && <p className="field-error" role="alert">{errors.name}</p>}
            </div>

            <div className="field">
              <label htmlFor="cg-email">Email address</label>
              <input
                id="cg-email"
                type="email"
                autoComplete="email"
                value={form.email}
                aria-invalid={errors.email ? 'true' : 'false'}
                onChange={set('email')}
              />
              {errors.email && <p className="field-error" role="alert">{errors.email}</p>}
            </div>

            <div className="field">
              <label htmlFor="cg-phone">Phone number</label>
              <input
                id="cg-phone"
                type="tel"
                autoComplete="tel"
                value={form.phone}
                aria-invalid={errors.phone ? 'true' : 'false'}
                onChange={set('phone')}
              />
              {errors.phone && <p className="field-error" role="alert">{errors.phone}</p>}
            </div>

            <div className="field">
              <label htmlFor="cg-category">Gift category</label>
              <select id="cg-category" value={form.category} onChange={set('category')}>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="cg-occasion">Occasion</label>
              <select id="cg-occasion" value={form.occasion} onChange={set('occasion')}>
                {OCCASIONS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="cg-budget">Budget range</label>
              <select id="cg-budget" value={form.budget} onChange={set('budget')}>
                {BUDGETS.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="cg-date">
                Preferred delivery date <span className="field-optional">optional</span>
              </label>
              <input
                id="cg-date"
                type="date"
                value={form.date}
                aria-invalid={errors.date ? 'true' : 'false'}
                onChange={set('date')}
              />
              {errors.date && <p className="field-error" role="alert">{errors.date}</p>}
            </div>

            <div className="field field--wide">
              <label htmlFor="cg-description">Describe the gift</label>
              <textarea
                id="cg-description"
                value={form.description}
                placeholder="Who is it for, what should it feel like, and anything that must be included."
                aria-invalid={errors.description ? 'true' : 'false'}
                onChange={set('description')}
              />
              {errors.description && <p className="field-error" role="alert">{errors.description}</p>}
            </div>

            <div className="field field--wide">
              <span className="field-label">
                Reference images <span className="field-optional">optional</span>
              </span>
              <PhotoUpload files={photos} onChange={setPhotos} max={10} label="Add reference images" />
            </div>
          </div>

          <p className="form-note">
            <Info size={14} style={{ verticalAlign: '-2px', marginRight: 6, color: 'var(--coral)' }} />
            This form is not connected to a backend yet, so submitting it prepares your request in the browser — it
            is not stored or emailed to us automatically. Use the email button that appears to send it across.
          </p>

          <button className="btn btn--primary btn--block" type="submit">
            Review my request
          </button>

          {sent && (
            <div className="form-note" role="status" style={{ background: 'var(--cream-2)' }}>
              <p style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>
                <Check size={15} style={{ verticalAlign: '-2px', marginRight: 6, color: 'var(--coral)' }} />
                Your request is ready — prepared {sent.at}
              </p>
              <p style={{ marginBottom: 10 }}>
                {sent.summary}
                {sent.photos ? ` · ${sent.photos} reference image${sent.photos === 1 ? '' : 's'} noted by name` : ''}.
                Nothing has been sent yet.
              </p>
              <a className="btn btn--primary btn--sm" href={mailto}>
                Send it to the studio
              </a>
            </div>
          )}
        </form>

        <aside className="stack">
          <div className="info-card">
            <h3>What we can make</h3>
            <ul className="pdp__list">
              <li>
                <Check size={15} />
                <span>Magazines built around a trip, a year, or a person.</span>
              </li>
              <li>
                <Check size={15} />
                <span>Polaroid sets with captions, strung or boxed.</span>
              </li>
              <li>
                <Check size={15} />
                <span>Bouquets in colours you choose, with a message card.</span>
              </li>
              <li>
                <Check size={15} />
                <span>Combinations of all three, wrapped as one gift.</span>
              </li>
            </ul>
          </div>

          <div className="info-card">
            <h3>How it goes</h3>
            <ol className="numbered">
              <li>You send the idea with this form.</li>
              <li>We reply with a plan and a quote.</li>
              <li>You confirm, and we make it by hand.</li>
              <li>We share the shipping cost before any payment.</li>
            </ol>
          </div>

          <div className="info-card">
            <h3>Prefer to talk?</h3>
            <p>
              Write to <a href={`mailto:${CONTACT.email}`} style={{ color: 'var(--coral)' }}>{CONTACT.email}</a> or
              call <a href={CONTACT.phoneHref} style={{ color: 'var(--coral)' }}>{CONTACT.phone}</a>. We are in{' '}
              {CONTACT.city}.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
