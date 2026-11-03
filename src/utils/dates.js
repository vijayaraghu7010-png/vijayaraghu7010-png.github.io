/* Turning what the database wrote into a Date the browser accepts.

   Postgres hands a timestamptz back as

       2026-11-02 15:19:06.411866+00

   and there are two things in that no Date parser is obliged to take:
   a space where ISO 8601 wants a T, and a two-digit offset where it
   wants "+00:00" or "Z". Either one alone makes the whole timestamp
   unparseable, and `new Date(...)` answers an Invalid Date rather
   than throwing - so the throw lands later, inside
   Intl.DateTimeFormat.format, in the middle of a render.

   That is exactly how the reviews went down: the admin panel and the
   product page both formatted a review's date straight out of the
   row, and one real review was enough to take the whole component
   with it.

   Returns null rather than an Invalid Date, so a caller has to decide
   what to show for one it could not read. */
export function parseDbDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const text = String(value)
    .trim()
    .replace(' ', 'T')
    .replace(/([+-]\d{2})$/, '$1:00');

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

/* The same, formatted, or '' when the date could not be read. Keeps
   every caller from having to write the null check and the format
   call in the same breath. */
export function formatDbDate(value, formatter) {
  const date = parseDbDate(value);
  return date ? formatter.format(date) : '';
}
