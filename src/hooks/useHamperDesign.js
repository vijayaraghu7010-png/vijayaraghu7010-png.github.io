import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';

import {
  activeDesignId,
  deleteDesign as dbDeleteDesign,
  deleteEverything,
  getDesign,
  listDesigns,
  putDesign,
  putDesignAsActive,
  putMeta,
  rememberActiveDesign,
  storedActiveDesignId,
  requestPersistentStorage,
  storageEstimate,
  storageUnavailableReason,
  pruneOrphanAssets
} from '../lib/designDb';
import { createSaver } from '../lib/designSaver';
import { designReducer, isCosmetic } from '../lib/designReducer';
import { assetIdsOf, createDesign, newId, validateDesign } from '../lib/designSchema';
import { applyPacking, packDesign, validateArrangement } from '../lib/packing';
import { missingAssetIds } from '../lib/designAssets';

/* ===========================================================
   The studio's one piece of state, and everything that keeps it
   on the customer's device.

   The order of events on load matters more than anything else here.
   Nothing is rendered until the saved design has been read, checked
   and its photos accounted for — a blank hamper that gets overwritten
   a moment later looks like the site lost the design even when it
   did not.
   =========================================================== */

export const PHASE = {
  LOADING: 'loading',
  READY: 'ready',
  /* IndexedDB could not be opened. The studio still works; nothing
     will survive the tab closing, and the UI says so. */
  MEMORY_ONLY: 'memory-only'
};

export default function useHamperDesign() {
  const [design, dispatch] = useReducer(designReducer, null, () => createDesign());
  const [phase, setPhase] = useState(PHASE.LOADING);
  const [save, setSave] = useState({ state: 'idle' });
  const [saved, setSaved] = useState([]);
  const [notices, setNotices] = useState([]);
  const [missingAssets, setMissingAssets] = useState([]);
  const [storage, setStorage] = useState(null);

  const saver = useRef(null);
  /* The reducer's output, readable from callbacks and unload handlers
     without making them depend on a render. */
  const current = useRef(design);
  current.current = design;

  const addNotice = useCallback((notice) => {
    setNotices((prev) => [...prev, { id: newId('notice'), ...notice }]);
  }, []);

  const dismissNotice = useCallback((id) => {
    setNotices((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const refreshSaved = useCallback(async () => {
    try {
      const rows = await listDesigns();
      setSaved(
        rows.map((row) => ({
          id: row.id,
          name: row.name,
          updatedAt: row.updatedAt,
          createdAt: row.createdAt,
          revision: row.revision,
          giftCount: (row.gifts || []).length,
          boxVariantId: row.box?.variantId,
          schemaVersion: row.schemaVersion,
          ordered: Boolean(row.orderedAs)
        }))
      );
    } catch {
      /* The list is a convenience; failing to read it must not take
         the editor down with it. */
    }
  }, []);

  const refreshStorage = useCallback(async () => {
    setStorage(await storageEstimate());
  }, []);

  /* Which of this design's photos are actually still on the device. */
  const checkAssets = useCallback(async (candidate) => {
    const gone = await missingAssetIds(assetIdsOf(candidate));
    setMissingAssets(gone);
    return gone;
  }, []);

  /* ------------------------------------------------------- startup */

  useEffect(() => {
    let cancelled = false;

    const saverInstance = createSaver({
      onStatus: (status) => {
        if (cancelled) return;
        setSave(status);

        if (status.state === 'error') {
          addNotice({
            tone: 'error',
            title: status.quota ? 'This browser is out of storage space' : 'Your design could not be saved',
            body: status.quota
              ? 'Your hamper is still here and still editable. Deleting a saved design you no longer need will make room, then press Retry.'
              : 'Your hamper is still here and nothing has been lost. Press Retry, or keep working and try again in a moment.'
          });
        }

        if (status.state === 'conflict') {
          addNotice({
            tone: 'error',
            title: 'This hamper was changed in another tab',
            body: 'To avoid overwriting the newer version, nothing has been saved from this tab. Open the hamper again to pick up the newer one — your changes here are still on screen, so copy anything you want to keep first.'
          });
        }
      }
    });
    saver.current = saverInstance;

    (async () => {
      let restored = null;
      let unavailable = false;

      try {
        /* Which design to open, in order of how much it can be
           trusted:

           1. The pointer written in the same transaction as the last
              save. Exactly as durable as the design itself.
           2. The localStorage hint, for a browser whose IndexedDB
              meta read fails but whose designs are readable.
           3. The design touched most recently — which is what
              recovers a session that ended in a crash, since the
              autosave had already written it.

           Order matters: after a force quit the localStorage hint can
           be older than the database, and following it would reopen
           the wrong hamper. That looks identical to losing work. */
        const durableId = await storedActiveDesignId().catch(() => null);
        const wantedId = durableId || activeDesignId();

        let record = wantedId ? await getDesign(wantedId) : null;

        if (!record) {
          const rows = await listDesigns();
          record = rows[0] || null;
        }

        if (record) {
          const result = validateDesign(record);

          if (result.ok) {
            restored = result.design;

            /* A record on disk is a set of positions nothing has
               checked since it was written. The kit's sizes may have
               been corrected, a model's shape may have changed, and
               anything saved before the studio started arranging the
               box itself was positioned by hand. So the arrangement
               is validated on the way in, and re-packed if it no
               longer holds — the customer gets a tidy box rather
               than two gifts inside each other. */
            if (!validateArrangement(restored).ok) {
              const repacked = applyPacking(restored, packDesign(restored));
              const lost = repacked.gifts.filter((g) => g.placed === false);
              restored = repacked;
              await putDesign(restored).catch(() => null);

              addNotice({
                tone: lost.length ? 'warn' : 'info',
                title: lost.length ? 'Your hamper was re-packed, with a note' : 'Your hamper was re-packed',
                body: lost.length
                  ? `Everything you chose is still here, but ${lost.length === 1 ? 'one gift no longer fits' : `${lost.length} gifts no longer fit`} this box. Choose a larger box, or take something out.`
                  : 'The gifts have been arranged again so that nothing overlaps. Nothing was removed.'
              });
            }

            if (result.notes.some((n) => n.kind === 'migrated')) {
              /* Write the migrated record back so the next load does
                 not have to migrate again — and so a later schema
                 only ever has to step forward by one. */
              await putDesign(restored).catch(() => null);
              addNotice({
                tone: 'info',
                title: 'Your saved hamper was brought up to date',
                body: 'It was saved by an earlier version of the studio. Everything in it has been kept.'
              });
            }

            const dropped = result.notes.filter((n) => n.kind === 'gift-unknown');
            if (dropped.length) {
              addNotice({
                tone: 'warn',
                title: `${dropped.length} item${dropped.length === 1 ? '' : 's'} could not be restored`,
                body: 'Something in this hamper is no longer offered, so it has been left out. The rest of your design is exactly as you left it.'
              });
            }

            const tall = result.notes.find((n) => n.kind === 'too-tall');
            if (tall) {
              const needs = [...new Set(tall.needs || [])];
              addNotice({
                tone: 'warn',
                title: `${tall.gifts.length === 1 ? 'One item does' : 'Some items do'} not fit in this box`,
                body: `${tall.gifts.join(', ')} ${tall.gifts.length === 1 ? 'does' : 'do'} not go into a ${tall.sizeLabel} hamper in any position.${
                  needs.length === 1 ? ` The smallest that would take ${tall.gifts.length === 1 ? 'it' : 'them'} is ${needs[0]}.` : ''
                } Nothing has been removed — choose a larger box, or take ${tall.gifts.length === 1 ? 'it' : 'them'} out.`
              });
            }

            /* The size this hamper was built at is no longer sold. It
               is still drawn and arranged at exactly those dimensions,
               which is the point — but it cannot be ordered, and the
               customer should hear that now rather than at checkout. */
            const unstocked = result.notes.find((n) => n.kind === 'box-size-unstocked');
            if (unstocked) {
              addNotice({
                tone: 'warn',
                title: 'This hamper’s size is no longer stocked',
                body: `It was built at ${unstocked.sizeLabel} and is still shown at exactly that size, but it cannot be ordered. Choose one of the sizes offered under Box when you are ready — your gifts will be arranged in it.`
              });
            }

            const over = result.notes.find((n) => n.kind === 'over-capacity');
            if (over) {
              addNotice({
                tone: 'warn',
                title: 'This hamper holds more than its box will take',
                body: `This box takes at most ${over.capacity} separate gifts. Remove ${over.by} item${over.by === 1 ? '' : 's'} or choose a larger box before ordering.`
              });
            }
          } else if (result.newer) {
            addNotice({
              tone: 'warn',
              title: 'A newer version of this design is saved on this device',
              body: 'It was made by a newer version of the site, so it is not being opened here rather than risk losing part of it. Reload the page to pick it up.'
            });
          } else {
            /* The record is not readable. Rather than start blank on
               top of it, the newest readable one is recovered and the
               broken record is left in place untouched. */
            const rows = await listDesigns().catch(() => []);
            const fallback = rows.map(validateDesign).find((r) => r.ok);
            if (fallback) {
              restored = fallback.design;
              addNotice({
                tone: 'warn',
                title: 'One saved design could not be read',
                body: 'Your most recent readable hamper has been opened instead. The unreadable record has been left alone, not deleted.'
              });
            } else {
              addNotice({
                tone: 'warn',
                title: 'A saved design could not be read',
                body: `Starting a new hamper instead. The old record has been left in place (${result.reason}).`
              });
            }
          }
        }
      } catch {
        unavailable = true;
      }

      if (cancelled) return;

      if (unavailable) {
        const reason = storageUnavailableReason();
        setPhase(PHASE.MEMORY_ONLY);
        addNotice({
          tone: 'error',
          title: 'This browser will not let the studio save your design',
          body:
            reason === 'private'
              ? 'Private browsing blocks the storage the studio saves into. You can still build a hamper and add it to your bag now, but it will be gone when you close this tab.'
              : 'Site storage is turned off or full, so your design cannot be kept on this device. You can still build a hamper and add it to your bag in this visit.'
        });
      } else {
        setPhase(PHASE.READY);
      }

      if (restored) {
        dispatch({ type: 'replace', design: restored });
        saverInstance.markSaved(restored);
        setSave({ state: 'saved', at: restored.lastSavedAt, revision: restored.revision });
        rememberActiveDesign(restored.id);

        const gone = await checkAssets(restored);
        if (gone.length && !cancelled) {
          addNotice({
            tone: 'warn',
            title: `${gone.length} photo${gone.length === 1 ? '' : 's'} could not be found on this device`,
            body: 'The rest of the hamper is exactly as you left it. Browser storage can be cleared by the browser itself or by clearing site data — upload the photo again to put it back.'
          });
        }
      }

      if (!unavailable) {
        refreshSaved();
        refreshStorage();
        /* Asked for once, in the background. A browser that refuses is
           the normal case, not an error. */
        requestPersistentStorage().then((result) => {
          putMeta('persistence', result).catch(() => null);
        });
        /* Assets from interrupted uploads, swapped photos and deleted
           designs, swept on the way in rather than on a timer. */
        pruneOrphanAssets().then((result) => {
          if (result?.removed) refreshStorage();
        }).catch(() => null);
      }
    })();

    return () => {
      cancelled = true;
      saverInstance.destroy();
    };
    /* Runs once: this is the studio's startup, not a subscription. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --------------------------------------------- change + autosave */

  /* Every change goes through here, so there is no way to change the
     hamper without scheduling a save. `immediate` is for the end of a
     drag and for anything about to navigate away. */
  const change = useCallback((action, { immediate = false } = {}) => {
    dispatch(action);
    /* The reducer has not run yet, so the design to save is computed
       the same way it will be. Cheap — it is a pure function — and it
       means the save queue never saves a render behind. */
    const previous = current.current;
    const next = designReducer(previous, action);
    current.current = next;

    /* A change the reducer refused — a gift added to a full box, a
       colour that is not in the palette — is not worth a write. */
    if (next === previous) return;

    if (phase === PHASE.MEMORY_ONLY) return;
    /* A cosmetic change (camera, selection) is worth storing but not
       worth a write of its own; it rides along with the next real
       change or the next flush. */
    if (isCosmetic(action.type) && !immediate) return;

    saver.current?.schedule(next, { immediate });
  }, [phase]);

  const flush = useCallback(async () => {
    if (phase === PHASE.MEMORY_ONLY) return;
    saver.current?.schedule(current.current);
    await saver.current?.flush();
  }, [phase]);

  const retry = useCallback(() => saver.current?.retry(), []);

  /* Leaving the page. `visibilitychange` is the one that fires
     reliably on mobile, where a tab is killed without a pagehide;
     the write is already debounced to under a second, so in practice
     there is rarely anything left to do by this point. */
  useEffect(() => {
    if (phase !== PHASE.READY) return undefined;

    const onLeave = () => {
      if (document.visibilityState === 'hidden') saver.current?.flush();
    };
    const onHide = () => saver.current?.flush();

    document.addEventListener('visibilitychange', onLeave);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onLeave);
      window.removeEventListener('pagehide', onHide);
    };
  }, [phase]);

  /* The browser's own "leave site?" prompt, only while a write is
     genuinely outstanding. */
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (phase === PHASE.MEMORY_ONLY && current.current.gifts.length) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
      if (saver.current?.hasUnsaved()) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
      return undefined;
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [phase]);

  /* ------------------------------------------- the saved-design set */

  const openDesign = useCallback(
    async (id) => {
      if (id === current.current.id) return { ok: true };

      /* Switching away must not leave the hamper being left behind
         half-written — and must not write it over the one being
         opened, which is why the flush happens first and the active
         pointer moves after. */
      await flush();

      const record = await getDesign(id).catch(() => null);
      if (!record) return { ok: false, error: 'That design is no longer on this device.' };

      const result = validateDesign(record);
      if (!result.ok) return { ok: false, error: `That design could not be opened (${result.reason}).` };

      dispatch({ type: 'replace', design: result.design });
      current.current = result.design;
      saver.current?.markSaved(result.design);
      setSave({ state: 'saved', at: result.design.lastSavedAt, revision: result.design.revision });
      /* Opening a design makes it the one a reload should return to,
         and that has to be recorded as durably as a save. */
      await putDesignAsActive(result.design).catch(() => null);
      rememberActiveDesign(result.design.id);
      setNotices([]);
      await checkAssets(result.design);
      return { ok: true };
    },
    [checkAssets, flush]
  );

  const startNew = useCallback(
    async ({ name } = {}) => {
      await flush();
      const fresh = createDesign({ name: name || `Hamper ${saved.length + 1}` });
      dispatch({ type: 'replace', design: fresh });
      current.current = fresh;
      setNotices([]);
      setMissingAssets([]);

      if (phase === PHASE.READY) {
        try {
          await putDesignAsActive(fresh);
          rememberActiveDesign(fresh.id);
          saver.current?.markSaved(fresh);
          setSave({ state: 'saved', at: Date.now(), revision: fresh.revision });
          refreshSaved();
        } catch {
          saver.current?.schedule(fresh, { immediate: true });
        }
      }
      return fresh;
    },
    [flush, phase, refreshSaved, saved.length]
  );

  /* A copy, with its own id — and sharing its photos, which are
     reference-counted rather than duplicated, so two designs built
     from the same picture cost one picture's worth of storage. */
  const duplicateDesign = useCallback(
    async (id) => {
      const record = await getDesign(id || current.current.id).catch(() => null);
      const source = record ? validateDesign(record) : { ok: true, design: current.current };
      if (!source.ok) return { ok: false, error: 'That design could not be copied.' };

      const copy = {
        ...source.design,
        id: newId('design'),
        name: `${source.design.name} (copy)`.slice(0, 60),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        revision: 1,
        lastSavedAt: null,
        orderedAs: null,
        gifts: source.design.gifts.map((g) => ({ ...g, uid: newId('gift') })),
        editing: { selectedGiftUid: null }
      };

      try {
        await putDesign(copy);
        await refreshSaved();
        return { ok: true, id: copy.id };
      } catch (err) {
        return { ok: false, error: 'There was no room to save the copy.', cause: err };
      }
    },
    [refreshSaved]
  );

  const renameDesign = useCallback(
    async (id, name) => {
      if (id === current.current.id) {
        change({ type: 'rename', name }, { immediate: true });
        await refreshSaved();
        return { ok: true };
      }
      const record = await getDesign(id).catch(() => null);
      if (!record) return { ok: false, error: 'That design is no longer on this device.' };
      try {
        await putDesign({ ...record, name: String(name).slice(0, 60), updatedAt: Date.now() });
        await refreshSaved();
        return { ok: true };
      } catch {
        return { ok: false, error: 'That design could not be renamed.' };
      }
    },
    [change, refreshSaved]
  );

  const removeDesign = useCallback(
    async (id) => {
      try {
        await dbDeleteDesign(id);
      } catch {
        return { ok: false, error: 'That design could not be deleted.' };
      }

      await refreshSaved();
      refreshStorage();

      /* Deleting the hamper that is open leaves the editor with
         nothing, so the next one is opened — or a new one started. */
      if (id === current.current.id) {
        const rows = await listDesigns().catch(() => []);
        const next = rows.map(validateDesign).find((r) => r.ok);
        if (next) {
          dispatch({ type: 'replace', design: next.design });
          current.current = next.design;
          saver.current?.markSaved(next.design);
          await putDesignAsActive(next.design).catch(() => null);
          rememberActiveDesign(next.design.id);
        } else {
          rememberActiveDesign(null);
          await startNew({ name: 'My hamper' });
        }
      }
      return { ok: true };
    },
    [refreshSaved, refreshStorage, startNew]
  );

  /* Asked for explicitly, from a confirm in the storage panel. Never
     called on logout, and never on its own. */
  const forgetEverything = useCallback(async () => {
    try {
      await deleteEverything();
    } catch {
      return { ok: false, error: 'This browser would not clear the saved designs.' };
    }
    await refreshSaved();
    refreshStorage();
    await startNew({ name: 'My hamper' });
    return { ok: true };
  }, [refreshSaved, refreshStorage, startNew]);

  const api = useMemo(
    () => ({
      design,
      phase,
      save,
      saved,
      notices,
      missingAssets,
      storage,
      change,
      flush,
      retry,
      dismissNotice,
      addNotice,
      openDesign,
      startNew,
      duplicateDesign,
      renameDesign,
      removeDesign,
      forgetEverything,
      refreshSaved,
      refreshStorage,
      checkAssets,
      hasUnsaved: () => Boolean(saver.current?.hasUnsaved())
    }),
    [
      design,
      phase,
      save,
      saved,
      notices,
      missingAssets,
      storage,
      change,
      flush,
      retry,
      dismissNotice,
      addNotice,
      openDesign,
      startNew,
      duplicateDesign,
      renameDesign,
      removeDesign,
      forgetEverything,
      refreshSaved,
      refreshStorage,
      checkAssets
    ]
  );

  return api;
}
