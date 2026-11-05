import { BRAND } from '../data/categories';
import { useText } from '../context/SiteConfigContext';

/* The shop's own name and lines, as the studio last saved them.

   `brand.name`, `brand.tagline` and `brand.footerLine` have been in
   the Site text panel since it was built, and nothing read any of
   them - the footer, the logo and the payment page all imported the
   BRAND constant instead. So renaming the shop in the panel saved a
   row and changed nothing a customer could see, which is the same
   fault the phone number had.

   Nothing but the words change. The font, the colour, the emoji and
   the place on the page all belong to the component and the
   stylesheet, so an edit lands exactly where the old text was. */
export default function useBrand() {
  return {
    name: useText('brand.name', BRAND.name),
    tagline: useText('brand.tagline', BRAND.tagline),
    footerLine: useText('brand.footerLine', BRAND.footerLine)
  };
}
