import type { FaqSection } from '@/lib/data/faq'
import { BATUMI_ROWS, MOSCOW_ROWS, SPB_ROWS, TBILISI_ROWS } from '@/lib/data/faq.rows'

// The English «Questions and answers». Mirrors faq.ts section by section —
// every number here is the live rule, so a rule change updates both files.
// The coin tables reuse the Russian rows; faqFor() renames the fish.
export const FAQ_EN: FaqSection[] = [
  {
    title: 'How to play',
    items: [
      {
        q: 'What is RANGE?',
        a: [
          'A game for anglers. The city is split into hexagonal sectors — about 600 metres across. Catch a fish in a sector and photograph it in the app — the sector becomes yours.',
          'Catches and sectors earn you coins, medals and places in the ratings, and in a clan — shared rewards too.',
        ],
      },
      {
        q: 'Which cities can I play in?',
        a: [
          'Five right now: Batumi, Moscow, Saint Petersburg, Sochi (with Adler) and Tbilisi. You pick the city when you sign up and can change it later: Profile → «City».',
          'Sectors run only along the water where you can actually fish: sea, rivers, lakes and ponds. There are none in reserves, ports, airports, military areas or other closed places. Every city has its own rating, clans and clan battle, and its local time zone.',
          'Sochi and Batumi play the marine and freshwater species of the Black Sea and its rivers. Tbilisi plays freshwater species (river, lake, pond). Moscow has the predator and peaceful fish of its rivers and ponds. Saint Petersburg has the same as Moscow plus the Gulf of Finland and Neva Bay species: smelt, Baltic herring, eel, flounder, salmon and more.',
        ],
      },
      {
        q: 'What are «First steps»?',
        a: [
          'Six tasks for a newcomer — a card on the map, on the right above the sector card:',
          ['Catch your first fish.', 'Strengthen a sector — catch one more fish in the same sector.', 'Collect the Treasury.', 'Collect the daily reward.', 'Complete a weekly challenge.', 'Join a clan.'],
          'Progress counts by itself, on any device. Finish all six and collect 100 coins. New players, and those who have not caught anything yet, see the list.',
        ],
      },
      {
        q: 'How do I log a catch?',
        a: [
          'Stand in a sector, tap the orange camera button at the bottom of the screen, photograph the fish and pick the species. Length, weight, method and bait are optional.',
          'The catch counts for the sector you are standing in now. Its card is the first one at the bottom of the map and the sector itself is outlined; the blue dot on the map follows you. If you are not in a sector, the bottom shows the sector with the freshest catch.',
          'Did not weigh it on the spot? Open your catch card and tap the pencil at the top (or the «Edit» button at the bottom): you can add the length, weight, method and bait later, at home. The species can be changed once, and the size and weight can be changed once too (entering them for the first time counts as that one time, so enter both together); the method and the bait as often as you like. The photo and sector do not change, and neither do the coins for the catch.',
        ],
      },
      {
        q: 'Why is a photo required?',
        a: ['The photo is the proof of the catch: without it the catch is not saved. Moderators delete catches with someone else’s or fake photos together with the coins for them.'],
      },
      {
        q: 'Can I add a catch from the gallery?',
        a: [
          'To the game — no: only a photo taken with the app’s camera on the spot counts.',
          'To the diary — yes, up to 10 photos at once: each has its own species, length and time (taken from the photo itself), and a sector if the photo has a location. This does not claim a sector and gives no coins.',
        ],
      },
      {
        q: 'Why is my catch not saved?',
        a: [
          [
            'You have to wait 2.5 minutes between catches.',
            'Allow the app to use your location and camera.',
            'Check that you are in one of the sectors on the map: a catch counts for the sector you stand in, and far from them it counts nowhere.',
            'The sector is under someone else’s shield: while the shield stands, a catch cannot count there — the app shows how long it has left and offers to save the catch to the diary.',
          ],
        ],
      },
      {
        q: 'No internet while fishing. What now?',
        a: [
          'Photograph the fish as usual and tap «Save offline». The catch waits on your phone and goes out by itself when you are back online — within a day.',
          'It counts by the time of the photo. The sector becomes yours only if nobody else has caught there since the photo.',
          'The app also opens with no internet: it keeps the last data — the map, your profile, the diary, the challenges. For that, open it once with a connection and add RANGE to your phone’s home screen. What the server decides (rating, chats, the shop, claiming against rivals) does not work offline; in Telegram on an iPhone a fully closed app will not start without a connection.',
        ],
      },
    ],
  },
  {
    title: 'Sectors',
    items: [
      {
        q: 'How do I claim a sector?',
        a: [
          'A free sector becomes yours with the first catch.',
          'Someone else’s sector may have a defence: each of your catches takes 1 off it, and when the defence runs out, the next catch takes the sector.',
          'On the map, each player’s sectors are in the colour they picked (yours in yours), with a skin on top of the colour. Grey ones are free. If a player did not pick a colour, their sectors are blue.',
        ],
      },
      {
        q: 'What is a sector’s defence?',
        a: [
          ['Defence goes from 0 to 3.', 'Each catch by the owner or their clan in the sector adds +1 to the defence, up to 3.', 'A catch by someone else takes 1 off, and the sector does not change hands.', 'When there is no defence, the next catch by someone else takes the sector — the new owner has defence 1.', 'If the owner and their clan do not fish here, the defence melts by 1 a day.'],
          'Tap the defence on the sector screen — the same rules are there.',
        ],
      },
      {
        q: 'What is a shield?',
        a: [
          'A shield covers a sector for 24 hours: while it stands, other anglers cannot log a catch here, but your clanmates can.',
          'Shields are not sold — you can only win them in the slots (5% chance per spin). A won shield goes into your reserve, which holds up to 3 shields; if the reserve is full, a shield that drops turns into 70 coins.',
          'Put a shield on with the «Put a shield on» button on your sector’s screen; if you are a co-holder of a clanmate’s sector you can too, with a shield from your reserve. How long the shield has left is shown right there, next to «Taken». A hot sector cannot be shielded until the end of the week.',
          'How many shields you have in reserve is shown at the top of the map — a teal shield badge (if double coins are on, there is one shared «×2 · shield» button). Tap it — a window with the reserve and a hint on where to place one.',
        ],
      },
      {
        q: 'A clanmate caught on my sector. Did they take it?',
        a: ['No. Clanmates do not take sectors from each other: the catch adds the clanmate as a co-holder, and a sector can have up to 4 owners. Any of them strengthens the defence. On the map such a sector is split into equal parts — each owner has their own, with their avatar and skin. In the profile, in «My» territories and in achievements it counts for each owner as a whole sector.'],
      },
      {
        q: 'What are hot sectors?',
        a: [
          'Every Friday at 12:00, two hot sectors of the week are picked in each city: the most popular one (most catches in 30 days) and its neighbour — the one that touches it. They burn on the map until the end of Sunday. The same sector is never hot two weeks in a row.',
          'A catch there brings ×2 coins (×3 with «Double coins»), and the Treasury pays triple. Whoever holds a hot sector at the end of Sunday gets 100 coins and a medal — if anyone caught at least one fish on that sector during the week. An untouched hot sector gives no reward.',
          'A hot sector cannot be shielded, and the Tide does not trigger when it is claimed — the sector is open to everyone until the end of the week.',
          'When the hot sectors are picked, the app shows them by itself the first time you open the map: the camera flies to each in turn, with a dimmed background and a hint with the rules. Once a week.',
        ],
      },
      {
        q: 'Who is a sector legend?',
        a: ['The angler who caught the most in the sector over the last 90 days — at least 10 catches. Their avatar is in a laurel wreath on the sector screen.'],
      },
      {
        q: 'Where do I see the bite forecast?',
        a: [
          'On the map — the «Bite» badge with today’s score. Tap it and the forecast opens: pick a day at the top (today and 3 more), the big number is the score for that whole day, with the best time beside it.',
          'Slide your finger along the «By the hour» scale — under it you see that hour’s score («3/5») and the weather: air, wind, pressure, wave. The scale has the numbers 1–5 on its left: each bar stands at the level of its score, and the current number lights up. Below — what helps the bite (green dot) and what hurts it (red); the sea water temperature is there too, for reference — it does not affect the score.',
          'On the sector screen — the forecast for that place and «What’s biting here»: which fish, when and on what they are caught here.',
        ],
      },
    ],
  },
  {
    title: 'Coins',
    items: [
      {
        q: 'How do I earn coins?',
        a: [
          [
            'A catch — from 5 to 250 coins: the rarer the fish, the more.',
            'Claiming a sector — +25, once a day for the same sector.',
            'The Treasury — coins for your sectors every day.',
            'The daily reward — for opening the app.',
            'Weekly challenges — from 10 to 150 coins per task.',
            'The slots, the clan chest and the Clan battle.',
          ],
        ],
      },
      {
        q: 'How many coins for which fish?',
        a: [
          'The coins for a catch depend only on the species — size and weight do not matter. The rarer the fish, the more it pays.',
          { title: 'Batumi and Sochi', rows: BATUMI_ROWS },
          { title: 'Tbilisi', rows: TBILISI_ROWS },
          { title: 'Moscow', rows: MOSCOW_ROWS },
          { title: 'Saint Petersburg', rows: SPB_ROWS },
          'On a hot sector the coins for a catch double, «Double coins» double too, and together it is ×3, not ×4. If the catch claimed the sector, there is another +25 on top (+50 with «Double coins»).',
        ],
      },
      {
        q: 'What is the Treasury?',
        a: [
          'Coins that build up for your sectors: 1 coin every 3 hours from each sector (8 a day, triple from a hot one). You can collect up to 30 coins a day.',
          'The coin badge at the top of the map shows how much has built up — tap it to collect. It builds up for no more than the last day, so come in every day.',
        ],
      },
      {
        q: 'How does the daily reward work?',
        a: ['Come in every day and collect the reward — the coin badge at the top of the map, by the logo (the Treasury is there too): 10, 15, 20, 25, 30, 35, 40, 50, 60 and 100 coins for 10 days in a row, then it starts over. Miss a day — the streak starts again.'],
      },
      {
        q: 'What do I spend coins on?',
        a: ['In the shop — avatar frames, profile backgrounds, name styles and sector skins (everyone sees them on the map). You can try anything on before buying. Boosts are there too.'],
      },
      {
        q: 'What do boosts do?',
        a: [
          [
            'Double coins — 60 (or «3 hooks» in the slots): for 24 hours ×2 coins for catches, claims, challenges, achievements and clan rewards (the Treasury, the daily reward and the slots are not doubled). While the doubling lasts there is a golden «×2» badge at the top of the map with the time left: tap it — a window with a timer and a list of what is doubled. On a hot sector a catch with it is ×3, not ×4. Coins for a catch have a «×2» mark.',
            'Tide — 220: the next sector you claim is protected for 48 hours (except a hot one — the Tide does not work there and waits for the next claim).',
            'Echo — 90: your next catch counts as two in challenges. It does not affect sector defence or claiming: someone else’s catch always takes 1 off the defence.',
            'Fourth challenge — 70: one more task for this week.',
            'Challenge swap — 20: change a task for another of the same level.',
          ],
        ],
      },
      {
        q: 'How do the slots work?',
        a: [
          'Every day — 1 free spin and one more for each catch, no more than 4 a day. Under the button you can see how many spins are left and how many more you can get for catches today.',
          'The reels show your city’s fish: in Batumi and Sochi horse mackerel, scorpionfish, bluefish and dogfish, in Moscow, Saint Petersburg and Tbilisi — perch, bream, pike and catfish. Plus a hook and a hex.',
          'Prizes: the jackpot (0.3% chance) — the «Katran» frame in Batumi and Sochi or «Catfish» in Moscow, Saint Petersburg and Tbilisi; these frames are not sold, you can only win them, and if you already have it — 300 coins. Also: a shield into the reserve (5%, shields exist only here; if the reserve already has 3 — 70 coins), double coins for a day (6%), 100 coins (4%), 3 horse mackerel or 3 perch — 25 coins (14%), 3 scorpionfish or 3 bream — a free spin (8%), a pair — 10 coins (38%). It is all in the pay table in the slots.',
          'The slots are in the Shop, the «Angler’s slots» block together with your balance: it shows how many spins are left; tap it and the slots open. While a spin is waiting, a «Slots» sticker hangs on the map and the number of spins is on the profile badge and on the «Shop». You can hide the sticker with the cross: for this time (until a new spin) or for good.',
          'The free spin from the slots and the spins RANGE sometimes gives are bonus ones: they do not burn at the end of the day and are used when the regular ones run out.',
        ],
      },
      {
        q: 'What is «Where is this?»?',
        a: [
          'The game of the day: a 360° panorama by the water in your city — an embankment, a beach, a pier, a riverbank. Turn it with your finger, zoom with two fingers, look for clues: buildings, piers, mountains, bridges.',
          'Tap «Pick a sector on the map» — the usual RANGE map opens. Tap the cell by the water where you think the panorama was taken and «It is here!». Right — +30 coins. Wrong — no coins, but the map shows both your cell and the right one, and the spot where the panorama was taken.',
          'Then comes the story of the place: who holds the sector (or that it is free and you can take it first), how much was caught here and by whom, which fish, the record (a fish of 300 g or 20 cm and up), the best time to bite and the three latest catches. If the sector is under a shield, it cannot be taken now, but you can fish there.',
          'The quest of the day: catch a fish in the panorama’s sector before midnight — +50 more coins, however you answered. The coins come by themselves, and a notification arrives in «Activity» and in Telegram.',
          'There is one panorama a day, the same for everyone in the city, and one try. A new one at midnight in your city’s time. Places rotate: the same sector usually comes up no more than once in two weeks, and neighbouring ones do not follow each other. After answering, the table of the day is visible. The entrance is the «Where is this?» card in the profile.',
          'The panoramas come from the open Mapillary database (CC BY-SA). All were shot from the shore, no further than ~80 m from the water, and exactly inside their sector — look for cells by the water. The author is credited at the bottom after you answer.',
        ],
      },
    ],
  },
  {
    title: 'Challenges and medals',
    items: [
      {
        q: 'What are weekly challenges?',
        a: [
          'Every week — 3 tasks of different difficulty: an easy one, a light one and a medium or hard one. Each pays from 10 to 150 coins. New tasks on Monday.',
          'The tasks are not only about fish: leave comments, collect likes and followers, write in the clan chat, play «Where is this?», spin the slots, collect the Treasury and the daily reward, claim a sector, catch a fish in a hot sector. Clan tasks only go to players who are in a clan.',
          'Tap a task to unfold it: you see how much is left and how many coins are already counted. If the week runs out, you still get part of the coins for the progress.',
        ],
      },
      {
        q: 'What are the medals around the avatar?',
        a: ['Medals are for special events: for example, holding a hot sector until the end of the week. Achievements in the profile are for catches, fish species and sectors. An achievement you have earned stays for good: if you lose the sectors, it does not go away, and the reward is not paid a second time.'],
      },
    ],
  },
  {
    title: 'Clans',
    items: [
      {
        q: 'How do I join a clan or create my own?',
        a: [
          'You can join a clan of your city: an open one right away, the others by request or invitation.',
          'A clan can be created by a player who has claimed at least 3 sectors. It costs 700 coins.',
        ],
      },
      {
        q: 'I removed a player from my clan. When can I invite them back?',
        a: [
          'A removed player can rejoin the same clan only 72 hours after the removal: before that an invitation or a request will not work, and they will see «You were recently removed from this clan».',
          'If they left on their own, they can come back after a day. For a day after any leaving or removal a player cannot join any clan of their city.',
        ],
      },
      {
        q: 'What is the Clan battle?',
        a: [
          'A weekly race of rowing boats. Only clans whose leader or a co-leader has opened the battle take part: on the clan screen, the «Clan battle» tab → «Join the clan battle». They pick the roster — from 3 players up to the whole clan («Select all» and «Clear selection» are there, and each player’s result from last week is shown) — and confirm. It can be opened any time in the week until Sunday, but metres count from the start, and after it players can only be added («Add players»; their metres count from when they join and the finish grows by 200 m each), never removed. If it is not opened, the clan does not take part that week.',
          'The clan’s boat moves forward for catches (+10 m), challenges (+20 m), claims (+30 m) and sectors taken from another clan (+50 m) — only by the players in the roster. One player brings in no more than 150 m a day.',
          'The finish is 200 m per rostered player (at least as for three). Reach it — 80 coins to every roster player who rowed. If at least two clans are in the battle, 1st, 2nd and 3rd place get another 120, 60 or 30. There is no penalty for taking part without a result.',
          'On the clan screen «Clan battle» is the first tab and «Chest» the last. The chest and the battle count metres each on their own: the chest collects everything the whole clan brought in during the week, with no daily limit and no sign-up — it works for every clan.',
        ],
      },
      {
        q: 'How does the clan chest work?',
        a: [
          'During the week the clan collects metres: a catch +10 m, claiming a sector +30 m, a completed challenge +20 m. There are 5 chests, and their thresholds grow with the number of members.',
          'On Sunday night everyone who brought in at least 10 m gets coins for the biggest open chest: 20, 45, 80, 120 or 170. The chests do not add up.',
        ],
      },
    ],
  },
  {
    title: 'More',
    items: [
      {
        q: 'Where can I see all the players?',
        a: [
          'The «Territories» tab → «Rating» → «All players»: everyone who plays, from all cities (you can keep only Batumi or Moscow). The order is «By rating» (first those with more sectors, then catches — all time) or «By name»; search by name is at the top, and to its right a filter: players without a clan (whom you can invite), in a clan, with sectors, new in two weeks, by city. Tap a player and their profile opens.',
        ],
      },
      {
        q: 'What is «Week in the city»?',
        a: ['A sticker on the map with last week’s results: how much was caught, the main fish and anglers, your own numbers. You can share each slide.'],
      },
      {
        q: 'Where is my diary?',
        a: [
          'In «My catches» — the «Diary» tab: fishing days with the weather, notes, trips without a catch and catches from the gallery.',
          'At the top — your statistics for all time, the last 7 or 30 days: how many trips, catches, species and places, the record (the heaviest fish, or the longest if the weight is not given) and the best time — the three hours when you bite most often. Tap a number and what is behind it opens: fishing days, all photos, species with the best size, places. Under every photo — the time it was caught.',
          'Each day has a «⋯» at the top right: add or edit a note and «Delete entry» — after confirmation the note and the gallery photos for that day disappear. Catches counted in the game stay: they are part of the game.',
        ],
      },
      {
        q: 'What does the Telegram bot send?',
        a: ['The most important things: your sector was taken or is under attack, new followers, the week’s results, «Still fishing?» if there has been no catch for a while. At night messages wait until 8 am. Turn it off with the «Telegram notifications» switch at the bottom of the profile or with the /stop command in the bot.'],
      },
      {
        q: 'How do I get into my account on another device?',
        a: [
          'In Telegram, just open RANGE: the account is tied to your Telegram and comes up by itself on any device where you are signed in to the same Telegram. If the first screen showed up anyway, tap «Sign in with Telegram».',
          'On the website in a browser, Telegram does not tell us who you are, so you need an email and password. If your account was made through Telegram, link an email in advance: Profile → «Link email».',
        ],
      },
      {
        q: 'How do I add RANGE to my home screen?',
        a: [
          'Profile → «Add RANGE to your home screen» — step-by-step instructions for your phone. The icon opens the game full screen, with no address bar. The button is gone once RANGE is already opened from the home screen. Once, when you land on the map, the app offers this by itself; if you closed it, the button stays in the profile.',
          [
            'iPhone on iOS 26 or newer: open RANGE in Safari → the three dots at the bottom right → «Share» → «Show More» → «Add to Home Screen» → turn on «Open as Web App» → «Add».',
            'iPhone on an earlier iOS: open RANGE in Safari → Share (in the middle of the bottom bar) → «Add to Home Screen» → «Add».',
            'Android: open it in Chrome → ⋮ → «Install app» (or «Add to Home screen»).',
            'Telegram: the button in the profile brings up Telegram’s own window — confirm «Add». If it did nothing — ⋮ in the corner of the RANGE window → «Add to Home Screen» (you need an up-to-date Telegram).',
          ],
        ],
      },
      {
        q: 'How do I write to support?',
        a: [
          'At the bottom of the profile — «How to play», under the search — «No answer here? Write to support». Describe what happened and attach a screenshot if needed.',
          'Each request is a chat: open it in «My requests» under the button and keep writing there, with a screenshot if needed. When support replies, «New message in your support chat» with an «Open» button appears in «Activity» and in Telegram.',
          'A new request — no more than once a minute and 5 a day; in a chat — up to 30 messages a day.',
        ],
      },
      {
        q: 'I saw a fake catch. What do I do?',
        a: ['Open the catch and tap «Report» under it. Moderators will check the photo.'],
      },
    ],
  },
]
