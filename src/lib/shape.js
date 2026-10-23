/* Which theme the shop should be wearing, and when.

   The row translators that used to live here went with the database -
   nothing speaks snake_case any more. What is left is the one rule
   that is not obvious from the data itself. */

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
