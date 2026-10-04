// Source dictionary. en.ts and ka.ts must mirror every key here (enforced by
// the Dict type in core.ts). Plural entries: { one, few, many, other } —
// «1 улов / 2 улова / 5 уловов».
export const ru = {
  common: {
    coins: { one: '{count} монета', few: '{count} монеты', many: '{count} монет', other: '{count} монеты' },
    tryAgain: 'Не получилось, попробуй ещё раз',
  },
  shop: {
    tabSlots: 'Слоты',
  },
  slots: {
    title: 'Рыбацкие слоты',
    spinsToday: 'Прокрутов сегодня: {left} из {total}',
    spin: 'Крутить бесплатно',
    spinning: 'Крутим…',
    noSpins: 'Прокруты на сегодня закончились',
    noSpinsHint: 'Поймай рыбу — получишь ещё прокрут. Завтра — снова бесплатный',
    perCatch: '+1 прокрут за каждый улов, до 4 в день',
    payTable: 'Таблица выигрышей',
    chance: 'Шанс',
    freeShields: 'Щитов в запасе: {count}. Поставить можно на экране своего сектора',
    result: {
      jackpot: 'Джекпот! Рамка «Катран» твоя',
      jackpotCoins: 'Джекпот! +{coins} монет',
      shield: 'Щит в запас — поставь его на свой сектор',
      double: 'Двойные монеты на 24 часа',
      lufar: 'Три луфаря! +{coins} монет',
      triple: 'Три в ряд! +{coins} монет',
      pair: 'Пара! +{coins} монет',
      none: 'Мимо. Повезёт в следующий раз',
    },
    rows: {
      jackpot: '3 катрана',
      shield: '3 соты',
      double: '3 крючка',
      lufar: '3 луфаря',
      triple: '3 ставриды или 3 скорпены',
      pair: '2 одинаковых',
    },
    rewards: {
      jackpot: 'Рамка «Катран»',
      shield: 'Щит в запас',
      double: '×2 монеты на сутки',
    },
    symbols: {
      stavrida: 'Ставрида',
      skorpena: 'Скорпена',
      lufar: 'Луфарь',
      katran: 'Катран',
      hook: 'Крючок',
      hex: 'Сота',
    },
  },
  daily: {
    title: 'Ежедневная награда',
    dayOf: 'день {day} из 10',
    claim: 'Забрать +{coins}',
    claiming: 'Забираем…',
    claimed: 'Награда за сегодня получена',
    tomorrow: 'Завтра +{coins}',
    hint: 'Заходи каждый день: пропустишь день — серия начнётся заново',
    broken: 'Серия прервалась — начинаем с первого дня',
  },
  treasury: {
    title: 'Казна',
    amount: '{available} из {cap}',
    collect: 'Собрать',
    perDay: { one: 'Приносит {count} монету в сутки', few: 'Приносит {count} монеты в сутки', many: 'Приносит {count} монет в сутки', other: 'Приносит {count} монеты в сутки' },
    capReached: 'Сегодня собрано {cap} из {cap} — завтра снова',
    empty: 'Копится: 1 монета за 3 часа с каждого сектора',
    collected: '+{coins} в кошелёк',
  },
  hot: {
    badge: 'Горячий сектор',
    until: 'до {time}',
    bonus: '×2 монеты за улов, ×3 в Казну',
    holdReward: 'Удержи до конца недели — +100 монет и медаль',
  },
  territory: {
    freeShield: 'Поставить бесплатный щит',
    freeShieldLeft: 'В запасе: {count}',
  },
}
