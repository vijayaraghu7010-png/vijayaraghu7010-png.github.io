/* Turning a number somebody typed into the forms links need.

   One number is entered in the panel and two links are derived from
   it. The alternative - a phone, a phoneHref and a whatsapp as three
   separate fields - is three things that must be edited in step, and
   the moment one is missed the dialler calls the old number while the
   page prints the new one. */

/* As tel: wants it: digits, and a leading + if there was one. Spaces,
   brackets and dashes are how people write numbers down and are not
   part of the number. */
export function telHref(phone) {
  const raw = String(phone ?? '').trim();
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return `tel:${raw.startsWith('+') ? '+' : ''}${digits}`;
}

/* As wa.me wants it: digits only, no plus, and the country code
   present - wa.me fails quietly without one. A bare ten-digit number
   is Indian, which is where this studio is; anything longer is taken
   to carry its own code already. */
export function whatsappNumber(phone, defaultCountryCode = '91') {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length === 10 ? `${defaultCountryCode}${digits}` : digits;
}

export function whatsappHref(phone) {
  const number = whatsappNumber(phone);
  return number ? `https://wa.me/${number}` : '';
}
