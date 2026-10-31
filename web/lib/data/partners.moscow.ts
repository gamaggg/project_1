import type { Lang } from '@/lib/i18n/core'
import type { PartnersCityText } from '@/lib/data/partners.shared'

// What differs on the Moscow page (Russian and English only); the rest is the Batumi text.
export const PARTNERS_MOSCOW: Partial<Record<Lang, PartnersCityText>> = {
  ru: {
    cityName: 'Москва и область',
    metaTitle: 'RANGE для бизнеса — ваше место на карте рыбаков Москвы',
    metaDescription:
      'Рыбаки Москвы и области уже играют в RANGE. Покажем ваш магазин, баню, кафе или прокат на карте у воды, дадим игрокам промокод и сделаем «Улов недели» от вашего имени.',
    eyebrow: 'Для бизнеса Москвы и области',
    lead: 'RANGE — игра-карта, в которой рыбаки Москвы и области ловят рыбу и захватывают сектора у рек и прудов. Магазин снастей, баня после рыбалки, кафе, прокат лодок или база отдыха — покажем вас именно там, где они рыбачат.',
    pilot: 'Набираем партнёров в Москве и области. Первые 10 дней бесплатно: добавим вас на карту и покажем, как рыбаки вас находят.',
    cityStatLabel: 'из них в Москве и области',
    address: 'Набережная ул., 12',
    shopDist: '400 м от воды',
    prize: 'Сертификат 3 000 ₽',
    board: [
      { name: 'Nika', result: 'Щука · 74 см' },
      { name: 'Alex', result: 'Карп · 61 см' },
      { name: 'Gio', result: 'Окунь · 38 см' },
    ],
  },
  en: {
    cityName: 'Moscow and the region',
    metaTitle: 'RANGE for business — your place on the anglers’ map of Moscow',
    metaDescription:
      'Anglers in Moscow and the region already play RANGE. We show your shop, bathhouse, café or rental on the map by the water, give players a promo code and run a “Catch of the week” in your name.',
    eyebrow: 'For businesses in Moscow and the region',
    lead: 'RANGE is a map game where anglers in Moscow and the region catch fish and claim sectors by rivers and ponds. A tackle shop, a bathhouse after fishing, a café, a boat rental or a holiday base — we show you right where they fish.',
    pilot: 'We are signing up partners in Moscow and the region. The first 10 days are free: we put you on the map and show how anglers find you.',
    cityStatLabel: 'of them in Moscow and the region',
    address: '12 Naberezhnaya St',
    shopDist: '400 m from the water',
    prize: '3,000 ₽ gift card',
    board: [
      { name: 'Nika', result: 'Pike · 74 cm' },
      { name: 'Alex', result: 'Carp · 61 cm' },
      { name: 'Gio', result: 'Perch · 38 cm' },
    ],
  },
}
