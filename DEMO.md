# Showing the shop to somebody else

For when you want to change things in the admin panel and have someone
on another machine — another house, another village — watch the shop
change as you do it.

Normally the panel keeps your edits in your own browser, so nobody else
ever sees them. For a demo that is no good, so there is a small server
that holds one shared copy of the shop and tells every open page the
moment it changes. It runs on your laptop and only while you want it.

## The short version

Three terminals, in this order.

```
npm run build          # 1. build the site  (again after any code change)
npm run demo           # 2. start the shared server on port 4000
cloudflared tunnel --url http://localhost:4000      # 3. the public link
```

`cloudflared` is installed (version 2026.10.3, in
`C:\Program Files (x86)\cloudflared`). It was added to the system PATH
by the installer, so **open a new terminal** for step 3 — a window that
was already open when it was installed will say "command not found".

Step 3 prints a link like:

```
https://something-random-words.trycloudflare.com
```

Send that to your friend. He opens it and sees the shop.

You open **http://localhost:4000/admin** on your own machine, sign in
with the ID `admin`, and change whatever you like. His page updates on
its own — no refreshing, usually inside a second. Theme, offers,
prices, text, products: all of it.

When you are done, press **Ctrl+C** in each terminal. The link stops
working immediately.

## Things worth knowing

**The link is public while it runs.** It is not listed or searchable,
so in practice only the person you send it to will find it — but
anybody who has it can open the shop, and the admin panel with it.
There is no password on `/admin`, so your friend could edit the shop
too. For a demo between two people that is usually fine. Stop the
tunnel when you are finished and the address is dead for good; the
next one you start gets a different name.

**Your laptop is the demo.** If it sleeps, loses wifi, or you close the
terminal, his page stops updating. Reconnecting happens by itself when
you come back.

**Edits made during a demo are kept** in `server/data/demo-site.json`,
so stopping the server does not lose them and the next demo starts
where you left off. Delete that file to go back to the shop as it is
written in `src/data`.

**It does not change how you normally work.** Opened any other way —
`npm run dev`, `npm run preview`, a built `dist/` on a static host —
the shop goes back to keeping edits in your own browser. The page works
out which it is; there is no switch to set.

**Changing code is different from changing content.** Content — prices,
copy, themes, offers, products — you do in the panel and he sees at
once. Code you change on your laptop, and it needs `npm run build`
again; his page picks it up on his next reload.

## If something is not working

**He sees the shop but your changes never arrive.** Check the terminal
running `npm run demo`: it prints a line each time something is saved,
with how many pages are listening. No line means the panel is not
reaching the server; no watchers means his page is not connected.

**He sees an older shop than you.** His page is probably on
`localhost` — make sure he is opening the tunnel link, not a local
address.

**The tunnel link stopped working.** They do not last forever. Ctrl+C
step 3 and run it again; it prints a new link to send.

**"dist/ is missing".** Run `npm run build` first.
