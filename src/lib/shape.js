/* Translates between the database row shape (snake_case, the shape
   Postgres likes) and the shape the storefront already speaks, which
   is the shape in src/data/products.js. Keeping the storefront's
   shape means no page or cart line had to change. */

export function rowToProduct(r) {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    category: r.category,
    categoryLabel: r.category_label,
    price: Number(r.price),
    priceMode: r.price_mode,
    unitLabel: r.unit_label || '',
    unitNoun: r.unit_noun || undefined,
    minQty: r.min_qty ?? undefined,
    setSize: r.set_size ?? undefined,
    image: r.image,
    alt: r.alt,
    gallery: r.gallery || [],
    shortDescription: r.short_description,
    description: r.description,
    details: r.details || [],
    occasions: r.occasions || [],
    keywords: r.keywords || [],
    customiser: r.customiser || undefined,
    sizeId: r.size_id || undefined,
    featured: Boolean(r.featured),
    published: r.published !== false,
    sortOrder: r.sort_order ?? 0,
    addedAt: r.added_at
  };
}

export function productToRow(p) {
  const row = {
    id: p.id,
    slug: p.slug,
    name: p.name,
    category: p.category,
    category_label: p.categoryLabel ?? '',
    price: Number(p.price) || 0,
    price_mode: p.priceMode || 'fixed',
    unit_label: p.unitLabel ?? '',
    unit_noun: p.unitNoun ?? '',
    min_qty: p.minQty ?? null,
    set_size: p.setSize ?? null,
    image: p.image ?? '',
    alt: p.alt ?? '',
    gallery: p.gallery ?? [],
    short_description: p.shortDescription ?? '',
    description: p.description ?? '',
    details: p.details ?? [],
    occasions: p.occasions ?? [],
    keywords: p.keywords ?? [],
    customiser: p.customiser || null,
    size_id: p.sizeId || null,
    featured: Boolean(p.featured),
    published: p.published !== false,
    sort_order: Number(p.sortOrder) || 0
  };
  if (p.addedAt) row.added_at = p.addedAt;
  return row;
}

export function rowToOffer(r) {
  return {
    id: r.id,
    code: r.code,
    title: r.title,
    description: r.description,
    discountType: r.discount_type,
    value: Number(r.value),
    appliesTo: r.applies_to || { scope: 'all' },
    minOrder: Number(r.min_order) || 0,
    maxDiscount: r.max_discount === null ? null : Number(r.max_discount),
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    active: Boolean(r.active),
    showBanner: Boolean(r.show_banner)
  };
}

export function offerToRow(o) {
  return {
    code: o.code ? String(o.code).trim().toUpperCase() : null,
    title: o.title ?? '',
    description: o.description ?? '',
    discount_type: o.discountType || 'percent',
    value: Number(o.value) || 0,
    applies_to: o.appliesTo ?? { scope: 'all' },
    min_order: Number(o.minOrder) || 0,
    max_discount: o.maxDiscount === '' || o.maxDiscount === undefined ? null : Number(o.maxDiscount),
    starts_at: o.startsAt || null,
    ends_at: o.endsAt || null,
    active: o.active !== false,
    show_banner: Boolean(o.showBanner)
  };
}

export function rowToTheme(r) {
  return {
    id: r.id,
    name: r.name,
    kind: r.kind,
    tokens: r.tokens || {},
    isDefault: Boolean(r.is_default),
    isActive: Boolean(r.is_active),
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    bannerText: r.banner_text || ''
  };
}

export function themeToRow(t) {
  return {
    name: t.name ?? 'Untitled',
    kind: t.kind || 'custom',
    tokens: t.tokens ?? {},
    is_active: Boolean(t.isActive),
    starts_at: t.startsAt || null,
    ends_at: t.endsAt || null,
    banner_text: t.bannerText ?? ''
  };
}

/* Which theme the storefront should be wearing right now: a scheduled
   festival theme that is inside its window wins over everything else,
   then any other active theme, then the default. */
export function pickActiveTheme(themes, now = new Date()) {
  const live = themes.filter((t) => {
    if (!t.isActive) return false;
    if (t.startsAt && new Date(t.startsAt) > now) return false;
    if (t.endsAt && new Date(t.endsAt) < now) return false;
    return true;
  });

  const scheduled = live
    .filter((t) => t.startsAt || t.endsAt)
    .sort((a, b) => new Date(b.startsAt || 0) - new Date(a.startsAt || 0));

  return scheduled[0] || live.find((t) => !t.isDefault) || live.find((t) => t.isDefault) || themes.find((t) => t.isDefault) || null;
}
