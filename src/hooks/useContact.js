import { CONTACT } from '../data/categories';
import { useText } from '../context/SiteConfigContext';
import { telHref, whatsappHref, whatsappNumber } from '../utils/phone';

/* The studio's own contact details, as the studio last saved them.

   These strings have been editable in the panel for as long as the
   content table has existed - `contact.phone`, `contact.email` and
   `contact.address` are all in siteDefaults, and all three have rows
   in the database. Nothing read them. The footer, the custom-gifts
   page and the WhatsApp link each imported the CONTACT constant
   straight out of src/data/categories.js, so changing the number in
   the panel wrote a row and changed nothing a customer could see.
   Saving appeared to work, which is the worst way for it not to.

   The shipped constant stays, as the fallback for a browser that
   cannot reach the database - the same arrangement the catalogue
   uses. */
export default function useContact() {
  const phone = useText('contact.phone', CONTACT.phone);
  const email = useText('contact.email', CONTACT.email);
  const city = useText('contact.address', CONTACT.city);

  return {
    phone,
    email,
    city,
    phoneHref: telHref(phone),
    whatsapp: whatsappNumber(phone),
    whatsappHref: whatsappHref(phone)
  };
}
