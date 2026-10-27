import { AlertTriangle, Check, RotateCcw, Shuffle } from 'lucide-react';

import { getBoxVariant, getGiftKind } from '../../data/hamperKit';
import { arrangementSummary, smallestBoxFor } from '../../lib/packing';

/* ===========================================================
   How the packing went, under the preview.

   There are no direction buttons here and there are not meant to
   be: the studio works out where every gift goes. What a customer
   needs instead is the answer to two questions — did everything go
   in, and can I ask it to try a different arrangement — and, when
   something did not fit, what to do about it.

   A gift that could not be placed is named, with the smallest box
   that would take it. "Could not fit" on its own is a dead end;
   "needs a 14 × 14 × 6 in box" is an action.

   And when the last arrangement that fitted is still on record —
   almost always the one from before a smaller box was tried — there
   is a way back to it, box and all. Trying a size should not cost
   somebody their hamper.
   =========================================================== */

function Unplaced({ design, gifts }) {
  const variant = getBoxVariant(design.box);

  return (
    <div className="arrange__problem" role="alert">
      <AlertTriangle size={16} aria-hidden="true" />
      <div>
        <p className="arrange__problem-title">
          {gifts.length === 1
            ? 'One gift could not be fitted in'
            : `${gifts.length} gifts could not be fitted in`}
        </p>
        <ul>
          {gifts.map((gift) => {
            const kind = getGiftKind(gift.kindId);
            if (!kind) return null;
            const needs = smallestBoxFor(kind, gift.scale);
            const biggerBox = needs && needs.id !== variant.id;

            return (
              <li key={gift.uid}>
                <strong>{kind.name}</strong>
                {needs === null
                  ? ' — it is too big for any box we stock.'
                  : biggerBox
                    ? ` — it needs a ${needs.sizeLabel} box.`
                    : ` — the ${variant.sizeLabel} box is too full to take it as well.`}
              </li>
            );
          })}
        </ul>
        <p className="field-hint">
          It is still in your hamper and still in the total. Choose a larger box, take something else out, or
          try a different arrangement — your order cannot be sent until everything fits.
        </p>
      </div>
    </div>
  );
}

export default function ArrangementBar({ design, change }) {
  const summary = arrangementSummary(design);
  const variant = getBoxVariant(design.box);

  /* Only offered when it would actually change something: a backup
     taken in this very box, with everything already fitting, is the
     arrangement on screen. */
  const backup = design.arrangementBackup;
  const canRestore = Boolean(backup) && (!summary.ok || backup.variantId !== variant.id);
  const backupBox = canRestore ? getBoxVariant({ variantId: backup.variantId, dimensions: backup.dimensions }) : null;

  if (!design.gifts.length) {
    return (
      <div className="arrange">
        <p className="field-hint">
          Add something from <strong>Add gifts</strong>. The studio packs the box for you — there is nothing to
          position by hand.
        </p>
      </div>
    );
  }

  return (
    <div className="arrange">
      <div className="arrange__row">
        <p className={`arrange__status${summary.ok ? ' is-ok' : ' is-warn'}`} role="status">
          {summary.ok ? (
            <>
              <Check size={15} aria-hidden="true" />
              {summary.placed === 1 ? 'One gift, packed and fitting.' : `All ${summary.placed} gifts packed and fitting.`}
            </>
          ) : (
            <>
              <AlertTriangle size={15} aria-hidden="true" />
              {summary.placed} of {summary.total} packed
            </>
          )}
        </p>

        <span className="arrange__actions">
          {canRestore && (
            <button
              className="btn btn--ghost btn--sm"
              type="button"
              onClick={() => change({ type: 'restore-arrangement' }, { immediate: true })}
            >
              <RotateCcw size={14} aria-hidden="true" /> Back to the {backupBox.sizeLabel} box
            </button>
          )}

          <button
            className="btn btn--ghost btn--sm"
            type="button"
            onClick={() => change({ type: 'rearrange' }, { immediate: true })}
          >
            <Shuffle size={14} aria-hidden="true" /> Rearrange the hamper
          </button>
        </span>
      </div>

      {!summary.ok && <Unplaced design={design} gifts={summary.unplaced} />}
    </div>
  );
}
