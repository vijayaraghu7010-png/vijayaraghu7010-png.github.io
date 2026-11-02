/* One place for money formatting so every price reads ₹1,499.

   Whole rupees are written whole: a bouquet is ₹1,499, not
   ₹1,499.00. But the paise have to survive when there are any.
   Everything was rounded to the rupee, and three per cent off a six
   rupee print is ₹5.82 - which came out as "₹6", struck through
   beside another "₹6". The shop appeared to be discounting nothing,
   and the bag's total did not add up from its own lines.

   So: no decimals when there are none, two when there are. */

const whole = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
});

const withPaise = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export function formatRupees(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '₹0';

  /* Decided on the rounded paise, not on the float: 5.819999…
     is ₹5.82 and 6.000000001 is ₹6. */
  const paise = Math.round(n * 100);
  const rupees = paise / 100;

  return (paise % 100 === 0 ? whole : withPaise).format(rupees).replace(/\s/g, '');
}

/* "₹6 each" / "₹150 per set of 25" / "₹1,499" */
export function formatPrice(product) {
  if (!product) return '';
  const base = formatRupees(product.price);
  return product.unitLabel ? `${base} ${product.unitLabel}` : base;
}
