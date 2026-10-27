import { useRef, useState } from 'react';
import { Copy, Download, FilePlus2, FolderOpen, Loader2, Pencil, Trash2, Upload } from 'lucide-react';

import { getBoxVariant } from '../../data/hamperKit';
import { downloadDesign, importDesign } from '../../lib/designBackup';
import { formatBytes } from '../../lib/designAssets';
import { PHASE } from '../../hooks/useHamperDesign';

/* ===========================================================
   Every hamper this browser is holding, plus what the customer can
   do with them and an honest account of where they are kept.

   The distinction the copy has to make, because it decides whether
   somebody loses work: these designs are on *this device, in this
   browser*. They are not in an account, they are not on the studio's
   computers, and clearing browser data removes them. Said plainly
   rather than buried.
   =========================================================== */

function ago(at) {
  const minutes = Math.round((Date.now() - at) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  return new Date(at).toLocaleDateString([], { day: 'numeric', month: 'short' });
}

export default function SavedDesignsPanel({ studio, isSignedIn }) {
  const { design, saved, phase, storage, openDesign, startNew, duplicateDesign, renameDesign, removeDesign, forgetEverything, refreshSaved, hasUnsaved, addNotice } = studio;

  const [busy, setBusy] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const [draftName, setDraftName] = useState('');
  const [wipeConfirm, setWipeConfirm] = useState(false);
  const importInput = useRef(null);

  /* Switching away from a hamper with a write still outstanding: the
     flush inside openDesign handles it, but the customer is asked
     first, because "open" should never be the thing that loses work. */
  const confirmLeave = () =>
    !hasUnsaved() ||
    window.confirm('This hamper has a change that has not finished saving. Open the other one anyway?');

  const act = async (key, fn) => {
    setBusy(key);
    try {
      const result = await fn();
      if (result && result.ok === false) {
        addNotice({ tone: 'error', title: 'That did not work', body: result.error });
      }
      return result;
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="stack">
      <div className="saved-head">
        <button
          className="btn btn--ghost btn--sm"
          type="button"
          disabled={busy === 'new'}
          onClick={() => {
            if (!confirmLeave()) return;
            act('new', () => startNew({ name: `Hamper ${saved.length + 1}` }));
          }}
        >
          {busy === 'new' ? <Loader2 size={14} className="spin" /> : <FilePlus2 size={14} />} Start another hamper
        </button>

        <button
          className="btn btn--quiet btn--sm"
          type="button"
          disabled={busy === 'copy'}
          onClick={() =>
            act('copy', async () => {
              const result = await duplicateDesign(design.id);
              if (result.ok) {
                addNotice({ tone: 'info', title: 'Copied', body: 'The copy is in the list below as its own hamper.' });
              }
              return result;
            })
          }
        >
          <Copy size={14} /> Duplicate this one
        </button>
      </div>

      {phase === PHASE.MEMORY_ONLY ? (
        <p className="field-error" role="alert">
          This browser will not let the studio save anything, so there is no list to show. Your hamper is still on
          screen and can still go in your bag in this visit.
        </p>
      ) : (
        <ul className="saved-list">
          {saved.map((row) => {
            const open = row.id === design.id;
            const variant = getBoxVariant(row.boxVariantId);

            return (
              <li key={row.id} className={`saved-row${open ? ' is-open' : ''}`}>
                {renaming === row.id ? (
                  <form
                    className="saved-row__rename"
                    onSubmit={(e) => {
                      e.preventDefault();
                      act('rename', () => renameDesign(row.id, draftName));
                      setRenaming(null);
                    }}
                  >
                    <input
                      type="text"
                      value={draftName}
                      maxLength={60}
                      aria-label="Design name"
                      /* eslint-disable-next-line jsx-a11y/no-autofocus */
                      autoFocus
                      onChange={(e) => setDraftName(e.target.value)}
                    />
                    <button className="btn btn--primary btn--sm" type="submit">
                      Save
                    </button>
                    <button className="btn btn--quiet btn--sm" type="button" onClick={() => setRenaming(null)}>
                      Cancel
                    </button>
                  </form>
                ) : (
                  <>
                    <div className="saved-row__main">
                      <p className="saved-row__name">
                        {row.name}
                        {open && <span className="saved-row__badge">open</span>}
                        {row.ordered && <span className="saved-row__badge saved-row__badge--ordered">ordered</span>}
                      </p>
                      <p className="saved-row__meta">
                        {variant.sizeLabel} · {row.giftCount}{' '}
                        {row.giftCount === 1 ? 'item' : 'items'} · saved {ago(row.updatedAt)}
                      </p>
                    </div>

                    <div className="saved-row__actions">
                      {!open && (
                        <button
                          className="icon-link"
                          type="button"
                          disabled={busy === row.id}
                          onClick={() => {
                            if (!confirmLeave()) return;
                            act(row.id, () => openDesign(row.id));
                          }}
                        >
                          <FolderOpen size={14} /> Open
                        </button>
                      )}
                      <button
                        className="icon-link"
                        type="button"
                        onClick={() => {
                          setRenaming(row.id);
                          setDraftName(row.name);
                        }}
                      >
                        <Pencil size={14} /> Rename
                      </button>
                      {confirming === row.id ? (
                        <>
                          <button
                            className="icon-link icon-link--danger"
                            type="button"
                            onClick={async () => {
                              await act(row.id, () => removeDesign(row.id));
                              setConfirming(null);
                            }}
                          >
                            Delete for good
                          </button>
                          <button className="icon-link" type="button" onClick={() => setConfirming(null)}>
                            Keep it
                          </button>
                        </>
                      ) : (
                        <button className="icon-link" type="button" onClick={() => setConfirming(row.id)}>
                          <Trash2 size={14} /> Delete
                        </button>
                      )}
                    </div>
                  </>
                )}
              </li>
            );
          })}

          {!saved.length && <li className="field-hint">Nothing saved yet — this hamper will appear here.</li>}
        </ul>
      )}

      {/* ----------------------------------------- device vs cloud */}

      <div className="storage-note">
        <h4>Where your designs are kept</h4>
        <p>
          On <strong>this device, in this browser</strong>. They are not in an account and not on our computers, so
          they will not appear on your phone if you built this on a laptop, and clearing your browsing data or site
          data will remove them.
        </p>
        <p>
          {isSignedIn
            ? 'Being signed in does not change that: the account on this site is a profile held in this browser, with no server behind it yet, so there is nothing to sync designs to. Signing out never deletes them.'
            : 'You do not need an account — nothing here is lost by staying signed out, and signing out never deletes a design.'}
        </p>
        <p>To move a hamper to another device, download it and open the file there.</p>

        <div className="storage-note__row">
          <button
            className="btn btn--ghost btn--sm"
            type="button"
            disabled={busy === 'export'}
            onClick={() =>
              act('export', async () => {
                const { skipped } = await downloadDesign(design);
                if (skipped.length) {
                  addNotice({
                    tone: 'warn',
                    title: 'Some photos were left out of the file',
                    body: `${skipped.length} photo${skipped.length === 1 ? '' : 's'} made the backup too large to be useful, so ${skipped.length === 1 ? 'it was' : 'they were'} not included. Everything else is in the file.`
                  });
                }
                return { ok: true };
              })
            }
          >
            {busy === 'export' ? <Loader2 size={14} className="spin" /> : <Download size={14} />} Download this
            hamper
          </button>

          <button
            className="btn btn--quiet btn--sm"
            type="button"
            disabled={busy === 'import' || phase === PHASE.MEMORY_ONLY}
            onClick={() => importInput.current?.click()}
          >
            <Upload size={14} /> Open a downloaded hamper
          </button>

          <input
            ref={importInput}
            className="sr-only"
            type="file"
            accept="application/json,.json"
            aria-label="Open a downloaded hamper file"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              const result = await act('import', () => importDesign(file));
              if (result?.ok) {
                await refreshSaved();
                addNotice({
                  tone: 'info',
                  title: 'Hamper imported',
                  body: `"${result.name}" is in the list above. Open it to carry on from there.`
                });
              }
            }}
          />
        </div>

        {storage && (
          <p className="field-hint">
            This site is using {formatBytes(storage.usage)} of the {formatBytes(storage.quota)} your browser allows
            it ({storage.percent < 1 ? 'under 1' : Math.round(storage.percent)}%).
          </p>
        )}

        {phase !== PHASE.MEMORY_ONLY && (
          <p className="storage-note__wipe">
            {wipeConfirm ? (
              <>
                <strong>Delete every hamper saved in this browser?</strong> This cannot be undone.{' '}
                <button
                  className="icon-link icon-link--danger"
                  type="button"
                  onClick={async () => {
                    await act('wipe', forgetEverything);
                    setWipeConfirm(false);
                  }}
                >
                  Delete them all
                </button>{' '}
                <button className="icon-link" type="button" onClick={() => setWipeConfirm(false)}>
                  Cancel
                </button>
              </>
            ) : (
              <button className="icon-link" type="button" onClick={() => setWipeConfirm(true)}>
                Remove every design stored in this browser
              </button>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
