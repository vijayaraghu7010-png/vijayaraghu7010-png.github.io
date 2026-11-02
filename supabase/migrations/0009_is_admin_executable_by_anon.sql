/* Letting a shopper read the shop.

   products_public_read and offers_public_read have always been
   `(published or is_admin())` and `(active or is_admin())` - the
   second half so the panel can see what the shop cannot. But
   is_admin() was only ever executable by `authenticated` and
   `service_role`, and a shopper who has not signed in is `anon`.

   Postgres checks the whole expression before it knows the first
   half would have answered, so every anonymous read of products or
   offers failed outright:

     42501: permission denied for function is_admin

   It went unnoticed for as long as the shop read its catalogue from
   localStorage and never asked the database at all. The moment the
   shop reads what the panel writes, it is the first thing to break.

   is_admin() is security definer and answers one question about the
   caller: is the email in this token in the admins table. For anybody
   who is not signed in that is `false`, which is the answer the
   policy wants. Being allowed to ask tells nobody anything they did
   not already know about themselves, and the admins table stays
   unreadable either way.                                           */

grant execute on function public.is_admin() to anon;
