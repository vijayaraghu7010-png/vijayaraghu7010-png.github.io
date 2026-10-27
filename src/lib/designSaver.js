/* ===========================================================
   The autosave queue.

   Three things have to be true at once, and each one rules out the
   obvious implementation:

   1. "Saved" may only appear after the IndexedDB transaction has
      committed. So the status is driven by the write finishing, not
      by the change being made.

   2. An older autosave must never land on top of a newer one. Dragging
      a gift fires changes faster than a write completes, so writes are
      serialised — one in flight, the latest state queued behind it —
      and a write whose revision is older than what is already stored
      is dropped.

   3. A failed save must not lose the change. The newest state stays in
      memory, the error is reported, and a retry writes the same thing
      again rather than an older copy.

   Deliberately not a React hook: a flush has to be able to run from a
   pagehide handler, after the component tree has stopped caring.
   =========================================================== */

import { getDesign, isQuotaError, putDesignAsActive, rememberActiveDesign } from './designDb';

export const SAVE_DEBOUNCE_MS = 700;

export function createSaver({ onStatus } = {}) {
  /* The newest state the editor has handed us, saved or not. */
  let latest = null;
  let timer = null;
  let writing = false;
  /* Set when a change arrives while a write is in flight. */
  let dirty = false;
  let lastSavedRevision = 0;
  let destroyed = false;

  const status = (state, extra = {}) => {
    if (!destroyed && onStatus) onStatus({ state, ...extra });
  };

  async function write() {
    if (writing || !latest) return;

    const design = latest;
    writing = true;
    dirty = false;
    status('saving');

    try {
      /* Another tab of the same browser may have saved this design
         while this one was editing. Writing over a higher revision
         would throw away whatever it did, so the write is refused and
         the editor is told to deal with it. */
      const stored = await getDesign(design.id).catch(() => null);
      if (stored && Number(stored.revision) > Number(design.revision)) {
        writing = false;
        status('conflict', { stored, local: design });
        return;
      }

      const record = { ...design, lastSavedAt: Date.now() };
      /* The design and the pointer to it, committed together. */
      await putDesignAsActive(record);
      /* The synchronous hint, for the next load's first paint. */
      rememberActiveDesign(record.id);

      lastSavedRevision = Number(record.revision) || 0;
      writing = false;

      /* Something changed while that write was in the air: go again
         rather than report a state that is already stale. */
      if (dirty && latest && Number(latest.revision) > lastSavedRevision) {
        write();
        return;
      }

      status('saved', { at: record.lastSavedAt, revision: lastSavedRevision });
    } catch (err) {
      writing = false;
      /* `latest` is untouched, so the change is still here to retry. */
      status('error', {
        error: err,
        quota: isQuotaError(err),
        /* A transaction that aborted may still have committed nothing;
           either way the next attempt writes the current state. */
        retryable: true
      });
    }
  }

  return {
    /* Called on every change. Collapses a burst — a colour picker
       being dragged, a gift being moved — into one write. */
    schedule(design, { immediate = false } = {}) {
      if (destroyed || !design) return;
      latest = design;
      dirty = true;

      if (writing) return; /* the in-flight write will pick this up */

      if (timer) clearTimeout(timer);
      if (immediate) {
        timer = null;
        write();
      } else {
        status('pending');
        timer = setTimeout(() => {
          timer = null;
          write();
        }, SAVE_DEBOUNCE_MS);
      }
    },

    /* Write now — the end of a drag, leaving the page, going to the
       bag. Resolves when there is nothing left to write. */
    async flush() {
      if (destroyed) return;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      await write();
      /* One more pass if the write that just finished uncovered a
         newer state. */
      if (dirty && !writing) await write();
    },

    retry() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      dirty = true;
      write();
    },

    /* True when the editor has changes the database has not got. */
    hasUnsaved() {
      return Boolean(latest) && Number(latest.revision) > lastSavedRevision;
    },

    /* Used when a design is opened from storage: it is already saved,
       so the indicator should not claim unsaved work. */
    markSaved(design) {
      latest = design;
      dirty = false;
      lastSavedRevision = Number(design?.revision) || 0;
    },

    destroy() {
      destroyed = true;
      if (timer) clearTimeout(timer);
      timer = null;
    }
  };
}
