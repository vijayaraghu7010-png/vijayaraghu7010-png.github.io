/* ===========================================================
   Taking a hamper from the studio to the bag.

   The design in IndexedDB is the customer's working copy. It is not
   evidence of anything: it has been sitting in their browser, it may
   be months old, and the prices in it are whatever the shop charged
   at the time. So at checkout everything is checked again from the
   trusted sources — the kit, the catalogue, the live offers — and the
   bag gets a price computed here, never one read back from storage.

   What goes in the bag is a reference, not the design: `WS-…`, plus
   the design id and the exact revision. The design itself is written
   back to IndexedDB with that reference recorded on it, so the order
   can always be reproduced from a hamper the studio can still open.
   =========================================================== */

import { STUDIO_PRODUCT_ID, getBoxVariant, getGiftKind } from '../data/hamperKit';
import { getProductById } from '../data/products';
import { assetIdsOf, describeDesign } from './designSchema';
import { missingAssetIds } from './designAssets';
import { arrangementSummary, validateArrangement } from './packing';
import { priceDesign } from './designPricing';
import { putAsset, putDesign } from './designDb';
import { newId } from './designSchema';

/* A short reference a customer can quote in an email. Not a secret
   and not a key — the design id is what actually identifies it. */
function orderReference() {
  const stamp = Date.now().toString(36).toUpperCase().slice(-5);
  const rand = Math.random().toString(36).toUpperCase().slice(2, 5);
  return `WS-${stamp}${rand}`;
}

/* Everything that would stop this hamper being ordered. Blocking
   problems come back as `errors`; things worth saying but not worth
   refusing over come back as `warnings`. */
export async function validateForOrder(design, offers = []) {
  const errors = [];
  const warnings = [];

  const studio = getProductById(STUDIO_PRODUCT_ID);
  if (!studio) {
    errors.push('The build-your-own hamper is not available in the shop at the moment.');
  }

  const variant = getBoxVariant(design?.box);
  if (!design?.gifts?.length) {
    errors.push('There is nothing in the box yet — add at least one gift.');
  }
  if (design?.gifts?.length > variant.capacity) {
    errors.push(
      `A ${variant.sizeLabel} hamper takes at most ${variant.capacity} separate gifts and this one has ${design.gifts.length}. Remove some, or choose a larger box.`
    );
  }

  /* A size the shop has stopped stocking. The hamper is still drawn
     and arranged at exactly the dimensions it was built at — see
     src/data/hamperBoxes.js — but it cannot be made, so it cannot be
     ordered either. */
  if (variant.stocked === false) {
    errors.push(
      `The ${variant.sizeLabel} hamper is no longer stocked. Choose one of the sizes offered in the studio, and your gifts will be arranged in it.`
    );
  }

  /* The arrangement, checked again from the geometry rather than from
     the flags on the record. This is the last gate before an order:
     nothing is sent that does not actually fit in the box it was
     ordered in. */
  if (design?.gifts?.length) {
    const arrangement = arrangementSummary(design);
    if (!arrangement.ok) {
      errors.push(
        `${arrangement.unplaced.length === 1 ? 'One gift does' : `${arrangement.unplaced.length} gifts do`} not fit in this hamper. Choose a larger box or take something out.`
      );
    }

    const check = validateArrangement(design);
    if (!check.ok) {
      errors.push(
        'The gifts in this hamper are not arranged validly. Press "Rearrange the hamper" and try again.'
      );
    }
  }

  design?.gifts?.forEach((gift) => {
    const kind = getGiftKind(gift.kindId);
    if (!kind) {
      errors.push('Something in this hamper is no longer offered. Remove it to carry on.');
      return;
    }
    if (gift.quantity > (kind.maxQty || 1)) {
      errors.push(`${kind.name}: at most ${kind.maxQty || 1} per hamper.`);
    }
    if (kind.productId && !getProductById(kind.productId)) {
      errors.push(`${kind.name} has sold out. Remove it to carry on.`);
    }
    if (kind.supportsPhoto && !gift.assetId) {
      warnings.push(`${kind.name} has no photograph yet — we will ask you for one.`);
    }
  });

  /* A price is recomputed here and nowhere else. */
  const pricing = priceDesign(design, offers);
  pricing.problems.forEach((problem) => {
    errors.push(
      problem.reason === 'product-missing'
        ? 'One item in this hamper is no longer in the shop. Remove it to carry on.'
        : 'One item in this hamper could not be priced. Remove it to carry on.'
    );
  });

  /* A photo whose blob has gone is not a reason to refuse the order —
     but the customer has to know it is not coming with it. */
  const gone = await missingAssetIds(assetIdsOf(design)).catch(() => []);
  if (gone.length) {
    warnings.push(
      `${gone.length} photo${gone.length === 1 ? '' : 's'} could not be found on this device and will not be sent. Upload ${gone.length === 1 ? 'it' : 'them'} again first if you want ${gone.length === 1 ? 'it' : 'them'} included.`
    );
  }

  return { ok: errors.length === 0, errors: [...new Set(errors)], warnings, pricing, variant, studio };
}

/* The picture on the order line. A preview, explicitly: the structured
   design is what gets made, and this is only so a customer can tell
   two hampers apart in their bag. */
async function snapshot(canvas) {
  if (!canvas) return null;
  try {
    const url = canvas.toDataURL('image/jpeg', 0.82);
    if (!url || url.length < 2048) return null;

    const blob = await (await fetch(url)).blob();
    const asset = {
      id: newId('preview'),
      blob,
      type: blob.type,
      bytes: blob.size,
      width: canvas.width,
      height: canvas.height,
      originalName: 'hamper-preview.jpg',
      preview: true,
      createdAt: Date.now()
    };
    await putAsset(asset);
    return { assetId: asset.id, dataUrl: url };
  } catch {
    /* A canvas that will not read back (a lost WebGL context, a
       browser that taints it) costs the thumbnail and nothing else. */
    return null;
  }
}

/* Validates, prices, snapshots, stamps the design and hands back
   everything the bag needs. Nothing is added to the bag here — that is
   the page's job, so one failure cannot leave a line in the bag with
   no design behind it. */
export async function prepareOrder(design, { offers = [], canvas = null } = {}) {
  const check = await validateForOrder(design, offers);
  if (!check.ok) return { ok: false, errors: check.errors, warnings: check.warnings };

  const preview = await snapshot(canvas);

  const orderedAs = {
    reference: orderReference(),
    designId: design.id,
    /* The exact version ordered. A later edit bumps the revision, so
       an order can always be told apart from what the hamper became. */
      revision: design.revision,
    at: Date.now(),
    pricing: {
      subtotal: check.pricing.subtotal,
      savings: check.pricing.savings,
      payable: check.pricing.payable,
      offer: check.pricing.offer
    },
    previewAssetId: preview?.assetId || null,
    summary: describeDesign(design),
    lines: check.pricing.lines.map((line) => ({
      label: line.label,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      total: line.total,
      productId: line.productId || null
    }))
  };

  /* The design is written back with the order on it, so the business
     can be sent a reference that resolves to something still here. If
     this write fails the order must not go ahead: a reference to a
     design that was never saved is worse than no order. */
  try {
    await putDesign({ ...design, orderedAs, updatedAt: Date.now() });
  } catch (err) {
    return {
      ok: false,
      errors: [
        'Your hamper could not be saved on this device, so it has not been added to your bag. Free up some space or delete a saved design, then try again.'
      ],
      warnings: check.warnings,
      cause: err
    };
  }

  return {
    ok: true,
    orderedAs,
    pricing: check.pricing,
    warnings: check.warnings,
    previewDataUrl: preview?.dataUrl || null,
    /* What addItem is given: a priced copy of the studio product, so
       the bag's own maths needs no special case for a hamper. */
    cartProduct: {
      ...check.studio,
      price: check.pricing.payable,
      name: `${design.name.trim() || 'Custom hamper'} (built by you)`
    },
    cartConfig: {
      designRef: orderedAs.reference,
      designId: design.id,
      revision: design.revision,
      summary: orderedAs.summary,
      itemCount: design.gifts.reduce((n, g) => n + g.quantity, 0),
      previewAssetId: orderedAs.previewAssetId,
      contents: orderedAs.lines.filter((l) => l.productId !== undefined).map((l) => `${l.quantity} × ${l.label}`),
      message: design.message.body.trim() ? 'message card included' : undefined
    }
  };
}
