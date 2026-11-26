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
          'Twelve right now. Russia: Moscow & MO, Saint Petersburg, Sochi/Adler, Kazan, Nizhny Novgorod, Anapa. Georgia: Batumi, Tbilisi. Bulgaria: Varna/Burgas. Ukraine: Kyiv, Odesa. Armenia: Yerevan/Sevan. You pick the city when you sign up and can change it later: Profile → «City». Your city isn’t there? On the city step of sign-up tap «Your city isn’t here?» and type it in — we’ll try to add it.',
          '«Moscow & MO» has sectors both in Moscow itself and in the Moscow Region up to the Central Ring Road (TsKAD). Kazan, Nizhny Novgorod, Kyiv, Odesa and Yerevan are the city and 30 km around it (ponds only in the city itself). «Varna/Burgas» is the whole Black Sea coast of Bulgaria with the Varna and Burgas lakes. Anapa is the coast of its district with the limans. «Yerevan/Sevan» is Yerevan and around plus the shore of Lake Sevan.',
          'Sectors run only along the water where you can actually fish: sea, rivers, lakes and ponds. There are none in reserves, ports, airports, military areas or other closed places. Every city has its own rating, clans and clan battle, and its local time zone.',
          'Batumi, Sochi/Adler, Anapa, Varna/Burgas and Odesa play the marine and freshwater species of the Black Sea and its rivers. Tbilisi and Yerevan/Sevan play freshwater species (river, lake, pond). Moscow, Kazan, Nizhny Novgorod and Kyiv have the predator and peaceful fish of rivers and ponds. Saint Petersburg has the same as Moscow plus the Gulf of Finland and Neva Bay species: smelt, Baltic herring, eel, flounder, salmon and more.',
        ],
      },
      {
        q: 'What are «First steps»?',
        a: [
          'Five tasks for a newcomer — a card on the map, on the right above the sector card:',
          ['Catch your first fish.', 'Strengthen a sector — catch one more fish in the same sector.', 'Collect the daily reward.', 'Complete a weekly challenge.', 'Join a clan.'],
          'Progress counts by itself, on any device. Finish all five and collect 100 coins. New players, and those who have not caught anything yet, see the list.',
        ],
      },
      {
        q: 'What is the «Newcomer task»?',
        a: [
          'Catch your first fish within 7 days of signing up and it pays triple the usual coins for its species, plus a shield in reserve (if you already have 3 shields, no new one is added). Coins for taking the sector come as usual.',
          'The task is given once. The time left shows on the «First steps» card on the map; in Telegram the bot reminds you on day 3 and day 6.',
        ],
      },
      {
        q: 'How do I log a catch?',
        a: [
          'Stand in a sector, tap the orange camera button at the bottom of the screen, photograph the fish and pick the species. Length, weight, method and bait are optional.',
          'The catch counts for the sector you are standing in now.',
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
        q: 'How do I see and show off my fish collection?',
        a: ['In your profile tap «species» — the «Fish species» screen opens: how many fish of the city’s list you have, the one you catch most, your record and newest species, every fish you caught with its drawing (tap a card for records, dates and the photo) and the ones still to catch as silhouettes. A fish counts once, whatever city it was caught in. Catch a fish in another city and that city’s whole category joins your collection (for example, all of Moscow’s predators).'],
      },
      {
        q: 'What are «Trophies» in the profile?',
        a: ['Up to three of your biggest catches: the longest first; if fewer than three have a length, the heaviest of those with only a weight fill the rest. Catches without a length or weight are not shown.'],
      },
      {
        q: 'Why is my catch not saved?',
        a: [
          [
            'You have to wait 2.5 minutes between catches.',
            'Allow the app to use your location and camera.',
            'Check that you are in one of the sectors on the map: a catch counts for the sector you stand in, and far from them it counts nowhere.',
            'The sector is under someone else’s shield and has no defense left: while the shield stands, the sector cannot be taken — the app shows how long it has left and offers to add the catch to the diary: it counts like any other (stats, challenges, awards, coins for the species), only the sector stays with its holder.',
          ],
        ],
      },
      {
        q: 'No internet while fishing. What now?',
        a: [
          'Photograph the fish as usual and tap «Save offline». The catch waits on your phone and goes out by itself when you are back online — within a day.',
          'It counts by the time of the photo. The sector becomes yours only if nobody else has caught there since the photo.',
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
        ],
      },
      {
        q: 'What is a shield?',
        a: [
          'A shield covers a sector for 24 hours: while it stands, the sector cannot be taken. A shield cannot go on top of another one — the next one goes on once this one ends. Someone else’s catch still wears its defense down (−1, as usual), but even at zero the sector does not change hands until the shield ends; such a catch can be added to the diary from the shield window and counts. Your clanmates fish as usual.',
          'Shields are not sold — you can only win them in the slots (3% chance per spin). A won shield goes into your reserve, which holds up to 3 shields; if the reserve is full, a shield that drops turns into 70 coins.',
          'Put a shield on with the «Put a shield on» button on your sector’s screen; if you are a co-holder of a clanmate’s sector you can too, with a shield from your reserve. How long the shield has left is shown right there, next to «Taken». A hot sector cannot be shielded until the end of the week.',
        ],
      },
      {
        q: 'A clanmate caught on my sector. Did they take it?',
        a: ['No. Clanmates do not take sectors from each other: the catch adds the clanmate as a co-holder, and a sector can have up to 4 owners. Any of them strengthens the defence. On the map such a sector is split into equal parts — each owner has their own, with their avatar and skin. In the profile, in «My» territories and in achievements it counts for each owner as a whole sector.'],
      },
      {
        q: 'What are hot sectors?',
        a: [
          'Every Friday at 12:00, two hot sectors of the week are picked in each city: a random one among those with 5 or more catches in 30 days, and its neighbour — the one that touches it. They burn on the map until the end of Sunday. The same sector is never hot two weeks in a row.',
          'A catch there brings ×2 coins (×3 with a clan «Outing» or «Double coins»), and such a sector pays triple rent into the clan treasury. Whoever holds a hot sector at the end of Sunday gets 100 coins and a medal — if anyone caught at least one fish on that sector during the week. An untouched hot sector gives no reward.',
          'A hot sector cannot be shielded, and the Tide does not trigger when it is claimed — the sector is open to everyone until the end of the week.',
        ],
      },
      {
        q: 'Who is a sector legend?',
        a: ['The angler who caught the most in the sector over the last 90 days — at least 10 catches. Their avatar is in a laurel wreath on the sector screen.'],
      },
      {
        q: 'What is a sector trophy?',
        a: ['The biggest fish ever caught in the sector: the heaviest catch with a weight, or, if nobody has entered a weight here, the longest one. It shows on the sector screen next to the legend once at least one catch has a weight or a length. Tap it to open the photo.'],
      },
      {
        q: 'Where do I see the bite forecast?',
        a: [
          'On the map — the «Bite» badge with today’s score. Tap it and the forecast opens: pick a day at the top (today and 3 more), the big number is the score for that whole day, with the best time beside it.',
          'On the sector screen — the forecast for that place and «What’s biting here»: which fish, when and on what they are caught here. The switch at the top of the block: «All time» (the default) or «30 days» — what has been biting this past month.',
          'If you hold a sector, in the evening the bot may write «Good bite tomorrow morning at your sector» — when the morning there (4 am to noon) scores 4–5 of 5. One message, for the best of your sectors; together with the city forecast, no more than twice a week and never two days running.',
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
            'Sector rent — it goes into the clan treasury: 1 coin every 3 hours from each sector.',
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
          { title: 'Batumi, Sochi/Adler, Anapa, Varna/Burgas, Odesa', rows: BATUMI_ROWS },
          { title: 'Tbilisi and Yerevan/Sevan', rows: TBILISI_ROWS },
          { title: 'Moscow & MO, Kazan, Nizhny Novgorod, Kyiv', rows: MOSCOW_ROWS },
          { title: 'Saint Petersburg', rows: SPB_ROWS },
          'On a hot sector the coins for a catch double; «Double coins» and a clan «Outing» are ×2 too. Any two of the three together are ×3, all three at once ×4. If the catch claimed the sector, there is another +25 on top (+50 with «Double coins»).',
        ],
      },
      {
        q: 'How does the daily reward work?',
        a: ['Come in every day and collect the reward — the coin badge at the top of the map, by the logo: 10, 15, 20, 25, 30, 35, 40, 50, 60 and 100 coins for 10 days in a row, then it starts over. Miss a day — the streak starts again.'],
      },
      {
        q: 'What do I spend coins on?',
        a: ['In the shop — avatar frames, profile backgrounds, name styles and sector skins (everyone sees them on the map and on the sector screen). You can try anything on before buying. Boosts are there too, and the secret box (a random item for 500 coins, open as many as you like).'],
      },
      {
        q: 'What do boosts do?',
        a: [
          [
            'Double coins are no longer sold (since 9 November 2026 the clan «Outing» takes their place), but they still drop in the slots («3 hooks»): for 24 hours ×2 coins for catches, claims, challenges, achievements and clan rewards (the daily reward and the slots are not doubled). On a hot sector a catch with them is ×3, not ×4.',
            'Tide — 220: the next sector you claim gets a 48-hour shield (except a hot one — the Tide does not work there and waits for the next claim).',
            'Echo — 90: your next catch counts as two in challenges. It does not affect sector defence or claiming: someone else’s catch always takes 1 off the defence.',
            'Fourth challenge — 70: one more task for this week.',
            'Challenge swap — 20: change a task for another of the same level.',
          ],
        ],
      },
      {
        q: 'What is the secret box?',
        a: [
          'The secret box is in the Shop, under the fishing slots. Opening it costs 500 coins, and you can open as many as you like. Inside is one random shop item: a frame, a background, a name style or a sector skin.',
          'Chances: a common item (price up to 400) — 70%, rare (401–900) — 22%, epic (901–1,700) — 6%, legendary (1,701 and up) — 2%. If you get an item you already own, you get half its price back in coins (a repeat of a 700-coin item gives 350). Free backgrounds and slot prizes (the Katran and Catfish frames) are not in the box.',
          'One prize in four in each group is coins instead of an item: 150 or 250 in common, 500 in rare, 1,000 in epic, 2,500 in legendary.',
          'A free box opening can be won on the slots (3 keys) or for 1st place in the weekly rating. It does not burn and is used first, instead of 500 coins.',
        ],
      },
      {
        q: 'Can I buy anything for Telegram Stars?',
        a: [
          'Yes, in RANGE inside Telegram: coins and keys with the «Top up» button in the Shop, everything else on the Shop tabs with a price in Stars. You pay with Stars right in Telegram, and the purchase arrives at once. On the website and in the installed app, tap the price: RANGE opens in Telegram right at that purchase and in your account, even if you have never opened it in Telegram. If you already have another account in Telegram, the game asks which one to keep there; two accounts cannot be merged.',
          'Coins: 500 — 50 ⭐, 1,500 — 125 ⭐, 5,000 — 350 ⭐. Keys: 1 — 40 ⭐, 3 — 100 ⭐, 5 — 150 ⭐; each key opens the secret box for free. Sector skins — 150 ⭐ each, five of them (northern lights, starfield, particles, beams, matrix); they can only be had for Stars and are not part of the kit.',
          'Live profile backgrounds — seven of them (northern lights, gradient, starfield, particles, beams, matrix, fog), 150 ⭐ each. Each has its own ready presets, which you can change before and after buying. Every background has its own frame and name style, 100 ⭐ each. All three together are a kit on the «Kits» tab: 300 ⭐ instead of 350. They are for Stars only: not for coins and not in the box. If you already own part of a kit, buy the rest separately.',
        ],
      },
      {
        q: 'How do the slots work?',
        a: [
          'Every day — 1 free spin and one more for each catch, no more than 4 a day. Under the button you can see how many spins are left and how many more you can get for catches today.',
          'The reels show your city’s fish: in the sea cities (Batumi, Sochi/Adler, Anapa, Varna/Burgas, Odesa) horse mackerel, scorpionfish, bluefish and dogfish, in the others — perch, bream, pike and catfish. Plus a hook, a hex and a key.',
          'Prizes: the jackpot (0.3% chance) — the «Katran» frame in the sea cities or «Catfish» in the others; these frames are not sold, you can only win them, and if you already have it — 300 coins. Also: a shield into the reserve (3%, shields exist only here; if the reserve already has 3 — 70 coins), double coins for a day (6%), 100 coins (4%), 3 horse mackerel or 3 perch — 25 coins (14%), 3 scorpionfish or 3 bream — a free spin (8%), three different fish — 15 coins (8%), 3 keys — a free secret box opening (1.5%), a pair — 10 coins (30.5%). It is all in the pay table in the slots.',
          'The free spin from the slots and the spins RANGE sometimes gives are bonus ones: they do not burn at the end of the day and are used when the regular ones run out.',
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
          'The tasks are not only about fish: leave comments, collect likes and followers, write in the clan chat, spin the slots, collect the daily reward, claim a sector, catch a fish in a hot sector. Clan tasks only go to players who are in a clan.',
          'Tap a task to unfold it: you see how much is left and how many coins are already counted. If the week runs out, you still get part of the coins for the progress.',
        ],
      },
      {
        q: 'What are the medals around the avatar?',
        a: ['Medals are for special events: for example, holding a hot sector until the end of the week. There are nine of them. On your own profile you see them all: the ones you have are in colour, the rest are grey with a lock; tap a medal to see how to earn it. The trophies for 1st, 2nd and 3rd place of the week are one, and the number on it is how many different places you have. Achievements in the profile are for catches, fish species and sectors. An achievement you have earned stays for good: if you lose the sectors, it does not go away, and the reward is not paid a second time.'],
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
          'The finish is 200 m per rostered player (at least as for three). Reach it — 80 coins to every roster player who rowed. If at least two clans are in the battle, 1st, 2nd and 3rd place get another 120, 60 or 30. There is no penalty for taking part without a result. Battle and chest coins go only to those who caught at least one fish that week.',
          'The chest and the battle count metres each on their own: the chest collects everything the whole clan brought in during the week, with no daily limit and no sign-up — it works for every clan.',
        ],
      },
      {
        q: 'What happens if a roster player leaves the clan or is kicked during the battle?',
        a: [
          'The metres they brought in while in the clan stay with the boat. After they leave, their catches and claims no longer move the clan’s boat.',
          'Their place in the roster is not freed: the finish stays 200 m for every roster player and does not get shorter. Other players can still be added, but each one makes the finish another 200 m longer.',
          'Battle and chest rewards go only to those who are in the clan on Sunday night, when the results are counted. A player who left or was kicked gets none, even if they rowed.',
        ],
      },
      {
        q: 'How does the clan chest work?',
        a: [
          'During the week the clan collects metres: a catch +10 m, claiming a sector +30 m, a completed challenge +20 m. There are 5 chests, and their thresholds grow with the number of members.',
          'On Sunday night everyone who brought in at least 10 m and caught at least one fish that week gets coins for the biggest open chest: 20, 45, 80, 120 or 170. The chests do not add up.',
        ],
      },
    ],
  },
  {
    title: 'The treasury and the clan base',
    items: [
      {
        q: "What is the clan's treasury and where do its coins come from?",
        a: [
          'The treasury is the clan\'s shared pot: the coins for sectors build up for the whole clan, not for one player.',
          [
            'Rent: every captured clan sector brings 1 coin every 3 hours (8 a day). A shared sector that clan-mates hold together brings one and a half times more, the HQ sector double (2 coins per 3 hours).',
            'The catch tax: 0, 5 or 10 % of the coins for a fish, but at least 1 coin per reward (nothing is taken from a 1-coin reward). The leader or the co-leader picks the rate; it is part of your reward, not taken on top.',
            'Deposits: any member can put in coins of their own; «All» puts in everything that can go in. The welcome bonus and the invite bonus cannot go in: only coins earned in the game go into the treasury (the gift can still be spent in the shop). The members list shows how much each one gave this month (deposits and the catch tax); the count starts again on the 1st. Whoever gave the most wears the «Patron of the month» crown. Everyone sees this column, clan-mates and players of other clans.',
            'A quarter of the coins from the week\'s chest and the clan battle, the weekly task reward and 100 coins for every newcomer who makes a first catch.',
          ],
          'It saves up to a cap: 3 000 coins for a clan of level 1–2, 5 000 for 3–4, 8 000 for 5–6, 12 000 for 7–8, 20 000 for 9–10; the Storehouse adds more. What does not fit is lost.',
        ],
      },
      {
        q: 'What is the clan HQ and what happens if it falls?',
        a: [
          'The HQ is the clan sector with its crest on it. The leader or the co-leader sets it only on a captured clan sector (1 000 coins from the treasury; moving it costs 2 000 and is allowed once in 3 days). A sector never has two HQs. While the HQ stands, the buildings work and the HQ sector pays double.',
          [
            'The HQ sector\'s defence is the same defence from 0 to 3. Every clan catch there adds 1, an outsider\'s catch takes 1 off.',
            'With no defence left, the next outsider\'s catch does not take the sector but starts a siege: the clan has 90 minutes (the Beacon adds up to 30). A catch by any member on the HQ sector lifts the siege and brings them 150 coins. A shield from your reserve cannot go on an HQ sector under siege: it would not help, and it stays in your reserve. When the HQ falls, the shield on its sector is removed and does not pass to the new owner.',
            'While the siege lasts the treasury is shut for spending: nothing can be bought in the clan shop, built or sped up, no «Outing» planned and the HQ cannot be moved. Deposits still go in, and the rent and the catch tax come as usual.',
            'If it is not lifted in time the HQ falls: the attackers carry off 20 % of the treasury (at most 1 500 coins), the HQ sector goes to them, the buildings fall asleep and a new HQ can only be set after 24 hours.',
            'Three quarters of the loot go to the attacker\'s clan treasury, or to the attacker personally if they have no clan. The remaining quarter is lost.',
            'The buildings keep their levels when the HQ falls: they sleep while the clan has no HQ and work again as soon as the clan sets a new HQ on any of its sectors.',
            'The first rebuild of the HQ after a fall is free, once in the clan\'s life. The next ones cost 1 000 coins from the treasury, like an ordinary placing.',
          ],
          'An attack on the HQ, a siege and a fall are sent to the whole clan in «Activity» and in Telegram: an attack at most once in 30 minutes, a siege at once, even at night (there are only 90 minutes to lift it). The attacking clan hears too: «our clanmate has put that clan’s HQ under siege», «the siege was broken» and «the HQ is taken, +N coins to the treasury».',
        ],
      },
      {
        q: 'How does the clan base work: buildings, build time, speed-up?',
        a: [
          'The base is the clan\'s sector with the HQ in the middle and six plots round it. Each plot takes one building of three levels; it boosts the clan while the HQ stands.',
          [
            'Dock: +2/+4/+6 places in the clan (900…4 500 coins).',
            'Beacon: 10/20/30 more minutes to lift a siege.',
            'Fort: the HQ sector\'s defence wears down 1 per 2/3/5 days instead of every day.',
            'Task board: the weekly task reward +15/30/50 %.',
            'Storehouse: the treasury cap +1 000/2 500/5 000.',
            'Market: the rent of every sector +5/10/15 %.',
          ],
          'Levels cost from 400 to 4 800 coins and the whole base 35 000: a clan that plays together builds it in about three months. The first level opens at clan level 2, the second at 4, the third at 6. A build takes time: from 12 hours (first level) to 4–5 days (the third level of the heavy buildings), one building at a time. An unfinished build can be completed at once with treasury coins: up to 35 % of the building\'s price, in proportion to the time left.',
        ],
      },
      {
        q: 'What is the clan «Outing»?',
        a: [
          'A clan buff in place of the personal «Double coins». The leader or the co-leader plans an «Outing» for 300 treasury coins to start in 5–180 minutes. Those who tap «I\'m in» get one more fish price per catch for 2 hours (×2), and their catches and sector captures bring one and a half times more metres in the clan battle (a catch 15 m instead of 10). The chest points do not change.',
          'At least three members must tap «I\'m in»: otherwise the «Outing» is cancelled and the coins go back to the treasury. After an «Outing» the clan rests for 12 hours. An «Outing» adds one more fish price per catch on top of everything else: with a hot sector or with «Double coins» it is ×3, with all three ×4.',
        ],
      },
      {
        q: 'What does the clan shop sell?',
        a: [
          'The clan shop is the third tab of the «Treasury» (Treasury · HQ · Shop). The leader and the co-leaders buy from the treasury; the others see the same and can try anything on. Every item opens with a clan level; any of them can be «Set as the goal»: then every member sees at the bottom of the treasury card what the clan is saving for and how much is left.',
          [
            'Sector skins: the same 18 skins the players have, five times dearer: from 1 500 to 15 000 coins. The skin lies on every clan sector on the «Clans» layer, in the crest\'s colour.',
            'Boats for the clan battle: «Coral» 3 000 (from clan level 2), «Night» 4 500 (from 4), «Golden» 6 000 (from 5), «Dragon» 9 000 (from 7).',
            'Frames round the crest on the clan screen, in the crest\'s own shape: «Bronze» 2 000 (from level 2), «Silver» 4 000 (from 4), «Gold» 7 000 (from 6), «Legendary» 12 000 (from 8). The «Champion» frame can\'t be bought: the clan gets it free at level 10, and the leader or a co-leader puts it on in the shop.',
          ],
          'What is bought is put on at once; you can take it off or put on something else you bought at any time.',
        ],
      },
      {
        q: 'How do I see another clan\'s base and join a clan?',
        a: [
          'Switch on the «Clans» layer on the map: the flags are the clans\' HQs. Tap a flag and open the sector: it shows that clan\'s base with its buildings and levels, the clan\'s level and how many places it has.',
          'If you are not in a clan, the «Join the clan» button leads to the clan\'s page: its conditions (open, by request or by invitation, how many sectors are needed) and the join button itself.',
        ],
      },
      {
        q: 'What if the leader is gone? How is leadership handed over and how is a clan disbanded?',
        a: [
          [
            'Roles: the leader can set anyone. A co-leader can make members elders or co-leaders and elders members again; they cannot touch another co-leader or the leader.',
            'Only the leader can hand leadership over: on the clan screen from a member\'s menu; you become the co-leader.',
            'If the leader does not open the app for 30 days, leadership passes to the co-leader by itself (no co-leader — to an elder, no elder — to whoever came in last), and the former leader becomes a co-leader. Catches do not matter here: it is enough for the leader to open the app at least once in 30 days.',
            'If the clan is disbanded, the treasury burns: the coins do not go to the players. This is so that coins cannot be taken out through a disbandment.',
          ],
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
          'The «Rating» tab → «All players»: everyone who plays, from every city. You can search by name, sort and filter — for example, find players without a clan to invite. Tap a player and their profile opens.',
        ],
      },
      {
        q: 'How do I quickly get a route to a sector?',
        a: ['On the «Rating» tab → «Territories», swipe a sector row to the left — «Route» (pick a maps app: Google, Yandex, Apple) and «On the map» (for sectors of the city on the map now) appear. On the sector screen «Route» is on the map at the top, next to «On the map»; the route window also lets you copy the coordinates.'],
      },
      {
        q: 'What is «Week in the city»?',
        a: ['A sticker on the map with last week’s results: how much was caught, the main fish and anglers, your own numbers. The angler of the week is whoever caught the most in the city that week; on a tie, whoever has more sectors of the week (as in the weekly rating). You can share each slide.'],
      },
      {
        q: 'How is the weekly rating counted?',
        a: [
          'Sectors of the week first, then catches in the city that week. A sector of the week is one you captured this week and still hold, or a share in a clanmate’s sector you joined this week. A catch on your own sector is not a capture: an old sector does not become a sector of the week. The week’s results use the same numbers.',
          'The top three of the week in each city get coins: 1st place — 300 and a key (a free secret box opening), 2nd — 200, 3rd — 100. You need at least 1 sector of the week.',
        ],
      },
      {
        q: 'What are the orange shop pins on the map?',
        a: [
          'These are RANGE partners: fishing shops, saunas, boat rentals and other places near the water. Tap a pin to open its card: photos, opening hours, the address (you can copy it) and the buttons «Directions» (Google, Yandex or Apple Maps), «Call» and «Website».',
          'The red badge on a pin is a discount for players. The card has a promo code: copy it or show the screen at the checkout. A pin stays while the partner’s period lasts and then disappears by itself.',
        ],
      },
      {
        q: 'What is a partner’s prize of the week?',
        a: [
          'Sometimes a partner sponsors a week in the city. Then a «Prize of the week» card with the prize and the partner’s name sits at the top of the weekly rating, and the partner’s pin wears a gold crown.',
          'The prize goes to the first in the weekly rating at the end of Sunday (sectors of the week first, then catches). Last week’s results show who got it; the winner shows that screen at the partner’s place and collects the prize.',
        ],
      },
      {
        q: 'Where is my diary?',
        a: [
          'In «My catches» — the «Diary» tab: fishing days with the weather, notes, trips without a catch and catches from the gallery.',
          'At the top — your statistics for all time, the last 7 or 30 days: how many trips, catches, species and places, the record (the heaviest fish, or the longest if the weight is not given) and the best time — the three hours when you bite most often.',
        ],
      },
      {
        q: 'What does the Telegram bot send?',
        a: ['The most important things: your sector was taken or is under attack, new followers, the week’s results, «you were overtaken in the weekly rating» (if you were in your city’s top 10 and went down; at most once in 3 hours, the same goes to «Activity»), «Still fishing?» if there has been no catch for a while. At night messages wait until 8 am. Turn it off with the «Telegram notifications» switch at the bottom of the profile or with the /stop command in the bot.'],
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
            'Telegram: the three dots in the top right corner of the RANGE window → «Add to Home Screen» (no such option — update Telegram).',
          ],
        ],
      },
      {
        q: 'How do I write to support?',
        a: [
          'At the bottom of the profile — «How to play», under the search — «No answer here? Write to support». Describe what happened and attach a screenshot if needed.',
          'Each request is a chat: open it in «My requests» under the button and keep writing there, with a screenshot if needed. When support replies, «New message in your support chat» with an «Open» button appears in «Activity» and in Telegram.',
        ],
      },
      {
        q: 'I saw a fake catch. What do I do?',
        a: ['Open the catch and tap «Report» under it. Moderators will check the photo.'],
      },
    ],
  },
]
