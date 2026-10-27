import { AlertTriangle, Check, CloudOff, Loader2, RefreshCw } from 'lucide-react';

import { PHASE } from '../../hooks/useHamperDesign';

/* ===========================================================
   The autosave indicator.

   It only ever says what is true. "Saved on this device" appears
   after the IndexedDB transaction has committed and not a moment
   earlier, which is why `saving` and `pending` are different states:
   one is a write in progress, the other is a change waiting for the
   debounce. A failure says the work is still here, because it is.
   =========================================================== */

function when(at) {
  if (!at) return '';
  const seconds = Math.round((Date.now() - at) / 1000);
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const date = new Date(at);
  const today = new Date().toDateString() === date.toDateString();
  return today
    ? `at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
    : `on ${date.toLocaleDateString([], { day: 'numeric', month: 'short' })}`;
}

export default function SaveStatus({ save, phase, onRetry, tick }) {
  if (phase === PHASE.MEMORY_ONLY) {
    return (
      <p className="save-status save-status--error" role="status">
        <CloudOff size={14} aria-hidden="true" />
        <span>
          <strong>Not being saved.</strong> This browser will not let the studio store your design, so it will be
          gone when you close the tab.
        </span>
      </p>
    );
  }

  if (save.state === 'saving' || save.state === 'pending') {
    return (
      <p className="save-status save-status--busy" role="status">
        <Loader2 size={14} className="spin" aria-hidden="true" />
        <span>Saving your design…</span>
      </p>
    );
  }

  if (save.state === 'error') {
    return (
      <p className="save-status save-status--error" role="status">
        <AlertTriangle size={14} aria-hidden="true" />
        <span>
          {save.quota ? 'No room left to save on this device.' : 'Unable to save right now.'} Your hamper is still
          here.
        </span>
        <button className="btn btn--ghost btn--sm" type="button" onClick={onRetry}>
          <RefreshCw size={13} /> Retry
        </button>
      </p>
    );
  }

  if (save.state === 'conflict') {
    return (
      <p className="save-status save-status--error" role="status">
        <AlertTriangle size={14} aria-hidden="true" />
        <span>This hamper was changed in another tab, so nothing has been saved from here.</span>
      </p>
    );
  }

  if (save.state === 'saved') {
    return (
      <p className="save-status save-status--ok" role="status">
        <Check size={14} aria-hidden="true" />
        {/* `tick` is only here so this line re-renders as the clock
            moves; the time itself comes from the save. */}
        <span key={tick}>
          Design saved on this device {when(save.at)}. You can close this page and carry on later.
        </span>
      </p>
    );
  }

  return (
    <p className="save-status" role="status">
      <span>Your design saves itself as you build it.</span>
    </p>
  );
}
