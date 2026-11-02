/* Letting a poster size be a price.

   price_variants.kind was written when the only variants were frame
   sizes and hamper boxes, and its check lists exactly those two. The
   catalogue script now emits a row per poster per size with
   kind = 'poster-size', and every one of them is refused by that
   constraint - so posters can be put in a basket and then cannot be
   priced, and the order is rejected at checkout.

   The list is widened rather than dropped. A kind is how the pricing
   function tells one sort of variant from another, and an open column
   would let a typo become a silently unpriceable product.          */

alter table public.price_variants
  drop constraint if exists price_variants_kind_check;

alter table public.price_variants
  add constraint price_variants_kind_check
  check (kind in ('frame-size', 'hamper-box', 'poster-size'));
