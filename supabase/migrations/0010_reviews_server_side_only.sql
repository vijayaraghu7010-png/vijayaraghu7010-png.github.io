/* Reviews stop being writable from the browser.

   `reviews_public_write` let the anon role INSERT into reviews with
   `with_check (true)`. The publishable key that role comes with is in
   the bundle, where it is meant to be, so in practice that policy let
   anybody write any number of reviews, at any rating, against any
   product id, with one curl command. Everything that looked like a
   check - one to five stars, a line of text, a name under eighty
   characters - lived in React and could be skipped by opening a
   console.

   The reviews-create Edge Function now does the same checks where
   they cannot be skipped, confirms the product exists, rate limits
   per caller and per product, and writes with the service role. The
   service role is not subject to RLS, so dropping this policy takes
   the open door away without taking the feature away.

   Reading is untouched: reviews are public, and reviews_public_read
   stays exactly as it was.

   ORDER MATTERS. Apply this only once the shop that calls
   reviews-create is live. Applied first, the deployed site goes on
   inserting directly and every review fails until the new bundle
   ships. */

drop policy if exists "reviews_public_write" on public.reviews;
