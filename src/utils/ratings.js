/* What a product's stars actually say.

   A rating typed into the admin panel is a claim; a rating worked out
   from reviews customers left is a fact. So reviews win wherever they
   exist, and the number in the panel is only what shows before the
   first one arrives - useful for carrying over a score the shop
   already earned somewhere else, and nothing more.

   `source` is passed on so the page can be honest about which it is
   looking at. */

export function ratingFor(product, reviews) {
  const mine = (reviews || []).filter((r) => r.productId === product?.id);

  if (mine.length) {
    const total = mine.reduce((sum, r) => sum + Number(r.rating || 0), 0);
    /* one decimal, which is all five stars can show anyway */
    return { value: Math.round((total / mine.length) * 10) / 10, count: mine.length, source: 'reviews' };
  }

  const claimed = Number(product?.rating || 0);
  if (claimed > 0) {
    return { value: claimed, count: Number(product?.reviews || 0) || 0, source: 'set' };
  }

  return { value: 0, count: 0, source: 'none' };
}

/* Newest first, which is the order anybody reads reviews in. */
export function reviewsFor(productId, reviews) {
  return (reviews || [])
    .filter((r) => r.productId === productId)
    .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
}

/* How many of each score, for the little bar chart under the average. */
export function spreadOf(list) {
  const buckets = [0, 0, 0, 0, 0];
  list.forEach((r) => {
    const i = Math.round(Number(r.rating)) - 1;
    if (i >= 0 && i < 5) buckets[i] += 1;
  });
  return buckets;
}
