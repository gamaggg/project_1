# Product

<!-- impeccable:product-schema 1 -->

> Written 09.11.2026 without the owner's interview round: the owner told the agent to proceed on its own («руки развязаны») and stepped away. Every fact below comes from the repository (CLAUDE.md, docs/, code) and the conversation; lines marked *(inferred)* are the agent's reading and need the owner's confirmation.

## Platform

web

## Users

- Anglers in Batumi, Moscow, Saint Petersburg, Sochi and Tbilisi who fish from the shore or a boat and log every catch with a photo. They open RANGE on the phone, mostly inside Telegram (Mini App) and also on catchrange.com or as a home-screen app, often outdoors, one-handed, between casts or right after a catch.
- Inside a clan there are three kinds of people: the leader and co-leaders (they spend the treasury, set the tax, place and move the HQ, pick builds), regular members (they fish, chip in, see what the clan is doing), and newcomers who just joined. *(inferred)* Regular members are the majority and the first audience of the clan screens; leaders need the controls but less often.
- Russian is the working language; English and Georgian are shown too (Georgian is checked by a native speaker).

## Product Purpose

RANGE turns fishing into a map game: a catch takes the water sector it was made in, sectors are held by players and clans, and everything pays coins. The clan update adds a shared clan economy and goals: the clan treasury («общак») fed by sector rent, a catch tax and deposits; a paid clan outing («выход») that boosts coins; the clan HQ on one of its sectors with defence and siege; a clan base with six buildings that give real perks; a weekly clan task; a hall of fame; animated clan skins. Success: a member understands in seconds what the clan has, what it is doing now and what they can do to help, and wants to come back to fish for the clan.

## Positioning

Everything in the clan is driven by real catches on real water: the HQ stands on a real sector of the map, the rent comes from sectors the members really hold, the weekly task counts real catches, the hall of fame shows real catch photos. A generic clan system in a mobile game cannot claim that link to a physical place and a physical catch.

## Operating Context

- Live: catchrange.com, Telegram bot @catchrangebot (Mini App, fullscreen with Telegram's own «Закрыть» / «⋯» floating over the top), home-screen install. Vercel autodeploy from `main`, Supabase database.
- The clan update is built in the branch `clan-update` and runs locally: in the real app with `?clan2=1` (bound to the player's real clan, read-only, the new economy simulated in the browser) and in a sandbox at `/clan-preview`.
- Phones of all kinds, including weak iPhones; Telegram iOS WebView is Safari and has been killed by heavy GPU use before (docs: «Известные ограничения»).

## Capabilities and Constraints

- Mechanics and numbers of the clan update are settled in `web/lib/clan2/rules.ts` and the owner's decisions; design work must not change them.
- The word is «сектор», never «территория». A sector is always drawn as the game's flat-top hexagon (`hex-aspect hex-shape`), no other polygons, no icons inside a sector in lists.
- Every change goes into `docs/70 Журнал/Журнал изменений.md`; rules or numbers that change go into the FAQ in three languages.
- No commit/push to `main` and no live-database writes without the owner's explicit command.
- Server side of the clan economy is not written yet; screens must not promise what the server does not do.

## Brand Commitments

- Name RANGE, brand orange `#FC5200`, light app screens with dark hero panels, rounded cards, the game's own sector pills (dark rounded label with the sector number), clan crests and colours chosen by the clan.
- Voice: plain Russian, short, friendly, no corporate tone; the owner speaks to players as fellow anglers.

## Evidence on Hand

- Real clan data through the app (the owner's clan BFC, id 34, Batumi: 11 members, 27 sectors, HQ on B0983), real catch photos, real sector geometry and the light map tiles used on the sector screen.
- No player research, no analytics on the clan screens yet; nothing about player behaviour may be invented.

## Product Principles

1. Fishing first: every clan screen answers «what does this mean for my next catch?» *(inferred)*
2. One glance, then depth: the state of the clan and the next action are visible at once; rules and history are one tap away, never in the way. *(inferred)*
3. Real over decorative: show the real map, the real catch, the real number, not a placeholder.
4. Show, then say: game-like pictures and progress carry the meaning; text explains only what a picture cannot. *(inferred)*
5. Respect the phone: light on the GPU, readable outdoors, one-handed.
