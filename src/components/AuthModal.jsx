import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Info, ShieldCheck, X } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { isAdminEmail } from '../lib/adminEmails';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function AuthModal({ open, mode = 'login', onClose }) {
  const { signUp, logIn } = useAuth();
  const { notify } = useCart();
  const navigate = useNavigate();

  const [tab, setTab] = useState(mode);
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const firstField = useRef(null);

  useEffect(() => {
    if (open) {
      setTab(mode);
      setErrors({});
      setForm({ name: '', email: '', password: '', confirm: '' });
    }
  }, [open, mode]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    const t = window.setTimeout(() => firstField.current?.focus(), 40);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      window.clearTimeout(t);
    };
  }, [open, onClose]);

  if (!open) return null;

  const isSignUp = tab === 'signup';
  const set = (key) => (e) => {
    const { value } = e.target;
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined, form: undefined }));
  };

  const goingToAdmin = !isSignUp && isAdminEmail(form.email);

  const toAdmin = () => {
    onClose();
    navigate('/admin');
  };

  const submit = (e) => {
    e.preventDefault();

    /* An administrator typing their own address wants the panel, not a
       shopper profile. The password they have is the Supabase one, and
       this box cannot check it, so hand them straight over. */
    if (goingToAdmin) {
      toAdmin();
      return;
    }

    const next = {};

    if (isSignUp && !form.name.trim()) next.name = 'Please tell us your name.';
    if (!form.email.trim()) next.email = 'Enter your email address.';
    else if (!EMAIL.test(form.email.trim())) next.email = 'That email address does not look right.';
    if (!form.password) next.password = 'Enter a password.';
    else if (isSignUp && form.password.length < 8) next.password = 'Use at least 8 characters.';
    if (isSignUp && form.confirm !== form.password) next.confirm = 'The two passwords do not match.';

    setErrors(next);
    if (Object.keys(next).length) return;

    const result = isSignUp ? signUp(form) : logIn(form);
    if (!result.ok) {
      setErrors({ form: result.error });
      return;
    }

    notify(isSignUp ? `Welcome, ${result.user.name.split(' ')[0]}` : `Welcome back, ${result.user.name.split(' ')[0]}`);
    onClose();
  };

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <div className="overlay__backdrop" onClick={onClose} />

      <div className="auth-modal">
        <button className="icon-btn auth-modal__x" type="button" aria-label="Close" onClick={onClose}>
          <X size={20} />
        </button>

        <h2 className="auth-modal__title" id="auth-title">
          {isSignUp ? 'Create your account' : 'Welcome back'}
        </h2>
        <p className="auth-modal__sub">
          {isSignUp
            ? 'Save your wishlist and keep your orders together.'
            : 'Sign in to pick up where you left off.'}
        </p>

        <div className="auth-tabs" role="tablist" aria-label="Login or sign up">
          <button
            type="button"
            role="tab"
            aria-selected={!isSignUp}
            className={!isSignUp ? 'is-on' : undefined}
            onClick={() => setTab('login')}
          >
            Log in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isSignUp}
            className={isSignUp ? 'is-on' : undefined}
            onClick={() => setTab('signup')}
          >
            Sign up
          </button>
        </div>

        <form className="auth-form" onSubmit={submit} noValidate>
          {isSignUp && (
            <div className="field">
              <label htmlFor="auth-name">Your name</label>
              <input
                id="auth-name"
                ref={firstField}
                type="text"
                autoComplete="name"
                value={form.name}
                aria-invalid={errors.name ? 'true' : 'false'}
                onChange={set('name')}
              />
              {errors.name && (
                <p className="field-error" role="alert">
                  {errors.name}
                </p>
              )}
            </div>
          )}

          <div className="field">
            <label htmlFor="auth-email">Email address</label>
            <input
              id="auth-email"
              ref={isSignUp ? undefined : firstField}
              type="email"
              autoComplete="email"
              value={form.email}
              aria-invalid={errors.email ? 'true' : 'false'}
              onChange={set('email')}
            />
            {errors.email && (
              <p className="field-error" role="alert">
                {errors.email}
              </p>
            )}
          </div>

          <div className="field">
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              value={form.password}
              aria-invalid={errors.password ? 'true' : 'false'}
              onChange={set('password')}
            />
            {errors.password && (
              <p className="field-error" role="alert">
                {errors.password}
              </p>
            )}
          </div>

          {isSignUp && (
            <div className="field">
              <label htmlFor="auth-confirm">Confirm password</label>
              <input
                id="auth-confirm"
                type="password"
                autoComplete="new-password"
                value={form.confirm}
                aria-invalid={errors.confirm ? 'true' : 'false'}
                onChange={set('confirm')}
              />
              {errors.confirm && (
                <p className="field-error" role="alert">
                  {errors.confirm}
                </p>
              )}
            </div>
          )}

          {errors.form && (
            <p className="field-error" role="alert">
              {errors.form}
            </p>
          )}

          {goingToAdmin && (
            <p className="auth-note auth-note--admin">
              <ShieldCheck size={13} aria-hidden="true" />
              <span>That is an administrator address — this takes you to the studio panel.</span>
            </p>
          )}

          <button className="btn btn--primary btn--block" type="submit">
            {goingToAdmin ? 'Go to admin panel' : isSignUp ? 'Create account' : 'Log in'}
          </button>

          <p className="auth-note" hidden={goingToAdmin}>
            <Info size={13} aria-hidden="true" />
            <span>
              No accounts server is connected yet, so this profile is kept on this device only and your password is
              never stored or checked anywhere. Real sign-in arrives with the backend.
            </span>
          </p>
        </form>
      </div>
    </div>
  );
}
