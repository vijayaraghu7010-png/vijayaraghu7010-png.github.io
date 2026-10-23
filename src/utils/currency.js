/* One place for money formatting so every price reads ₹1,499. */

const formatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
});

export function formatRupees(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '₹0';
  return formatter.format(n).replace(/\s/g, '');
}

/* "₹6 each" / "₹150 per set of 25" / "₹1,499" */
export function formatPrice(product) {
  if (!product) return '';
  const base = formatRupees(product.price);
  return product.unitLabel ? `${base} ${product.unitLabel}` : base;
}
