-- WrappedStudio — repair the two admin sign-ins
--
-- Run this in Supabase -> SQL Editor (project rhzqveijuclwegztogsr).
--
-- Both accounts already exist. Checked 2026-10-23:
--   vijayaraghu7010@gmail.com  confirmed,     1 identity  -> works
--   roshinip.0931@gmail.com    NOT confirmed, 1 identity  -> cannot sign in
--
-- An unconfirmed account is rejected at sign-in with "Email not confirmed",
-- whatever the password is. This sets both passwords to a known value and
-- confirms anything still unconfirmed.
--
-- BEFORE RUNNING: change the password below if you don't want admin@12345.
-- Safe to re-run.

update auth.users
set encrypted_password = extensions.crypt('admin@12345', extensions.gen_salt('bf')),
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    updated_at         = now()
where lower(email) in ('vijayaraghu7010@gmail.com', 'roshinip.0931@gmail.com');

-- The API checks this table as well as Auth, so make sure both are listed.
insert into admins (email)
select lower(email) from auth.users
where lower(email) in ('vijayaraghu7010@gmail.com', 'roshinip.0931@gmail.com')
on conflict (email) do nothing;

-- Every column below should read true / 1 for both rows.
select u.email,
       u.email_confirmed_at is not null as confirmed,
       u.encrypted_password = extensions.crypt('admin@12345', u.encrypted_password) as password_matches,
       (select count(*) from auth.identities i
         where i.user_id = u.id and i.provider = 'email') as email_identity,
       exists (select 1 from admins a
                where lower(a.email) = lower(u.email)) as in_admins
from auth.users u
order by u.email;
