import type { Dict } from '@/lib/i18n/core'

// Georgian: a noun after a number stays in the singular («10 მონეტა»), so
// most entries need no plural forms.
export const ka: Dict = {
  common: {
    coins: { one: '{count} მონეტა', other: '{count} მონეტა' },
    tryAgain: 'ვერ მოხერხდა, სცადე ხელახლა',
  },
  shop: {
    tabSlots: 'სლოტები',
  },
  slots: {
    title: 'მეთევზის სლოტები',
    spinsToday: 'დღევანდელი დატრიალებები: {left} / {total}',
    spin: 'დაატრიალე უფასოდ',
    spinning: 'ტრიალებს…',
    noSpins: 'დღევანდელი დატრიალებები ამოიწურა',
    noSpinsHint: 'დაიჭირე თევზი და მიიღებ კიდევ ერთ დატრიალებას. ხვალ პირველი ისევ უფასოა',
    perCatch: '+1 დატრიალება ყოველ დაჭერილ თევზზე, დღეში 4-მდე',
    payTable: 'მოგებების ცხრილი',
    chance: 'შანსი',
    freeShields: 'ფარები მარაგში: {count}. ფარის დადება შეგიძლია შენი სექტორის გვერდზე',
    result: {
      jackpot: 'ჯეკპოტი! ჩარჩო „კატრანი" შენია',
      jackpotCoins: 'ჯეკპოტი! +{coins} მონეტა',
      shield: 'ფარი მარაგში — დადე ის შენს სექტორზე',
      double: 'ორმაგი მონეტები 24 საათით',
      lufar: 'სამი ლუფარი! +{coins} მონეტა',
      triple: 'სამი ერთნაირი! +{coins} მონეტა',
      pair: 'წყვილი! +{coins} მონეტა',
      none: 'ამჯერად არ გაგიმართლა',
    },
    rows: {
      jackpot: '3 კატრანი',
      shield: '3 ფიჭა',
      double: '3 კაუჭი',
      lufar: '3 ლუფარი',
      triple: '3 სტავრიდა ან 3 სკორპენა',
      pair: '2 ერთნაირი',
    },
    rewards: {
      jackpot: 'ჩარჩო „კატრანი"',
      shield: 'ფარი მარაგში',
      double: '×2 მონეტა 24 საათით',
    },
    symbols: {
      stavrida: 'სტავრიდა',
      skorpena: 'სკორპენა',
      lufar: 'ლუფარი',
      katran: 'კატრანი',
      hook: 'კაუჭი',
      hex: 'ფიჭა',
    },
  },
  daily: {
    title: 'ყოველდღიური ჯილდო',
    dayOf: 'დღე {day} / 10',
    claim: 'აიღე +{coins}',
    claiming: 'ვიღებთ…',
    claimed: 'დღევანდელი ჯილდო აღებულია',
    tomorrow: 'ხვალ +{coins}',
    hint: 'შემოდი ყოველდღე: თუ ერთ დღეს გამოტოვებ, სერია თავიდან დაიწყება',
    broken: 'სერია შეწყდა — ვიწყებთ პირველი დღიდან',
  },
  treasury: {
    title: 'ხაზინა',
    amount: '{available} / {cap}',
    collect: 'აიღე',
    perDay: { one: 'იძლევა {count} მონეტას დღეში', other: 'იძლევა {count} მონეტას დღეში' },
    capReached: 'დღეს აღებულია {cap} / {cap} — ხვალ ისევ',
    empty: 'გროვდება: 1 მონეტა ყოველ 3 საათში თითო სექტორიდან',
    collected: '+{coins} საფულეში',
  },
  hot: {
    badge: 'ცხელი სექტორი',
    until: '{time}-მდე',
    bonus: '×2 მონეტა დაჭერაზე, ×3 ხაზინაში',
    holdReward: 'შეინარჩუნე კვირის ბოლომდე — +100 მონეტა და მედალი',
  },
  territory: {
    freeShield: 'დადე უფასო ფარი',
    freeShieldLeft: 'მარაგში: {count}',
  },
}
