import type { Lang } from '@/lib/i18n/core'
import type { PartnersCityText } from '@/lib/data/partners.shared'

// What differs on the Moscow page (Russian and English only); the rest is the Batumi text.
export const PARTNERS_MOSCOW: Partial<Record<Lang, PartnersCityText>> = {
  ru: {
    cityName: 'Москва и область',
    metaTitle: 'RANGE для магазинов — ваш магазин на карте рыбаков Москвы',
    metaDescription:
      'Рыбаки Москвы и области уже играют в RANGE. Покажем ваш магазин на карте у воды, дадим им промокод и сделаем «Улов недели» от вашего имени.',
    eyebrow: 'Для рыболовных магазинов Москвы и области',
    lead: 'RANGE — игра-карта, в которой рыбаки Москвы и области ловят рыбу и захватывают сектора у рек и прудов. Мы покажем им ваш магазин именно там, где они выбирают снасти и наживку.',
    pilot: 'Набираем магазины в Москве и области. Первые 10 дней бесплатно: подключим магазин и покажем, как рыбаки находят вас на карте.',
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
    metaTitle: 'RANGE for shops — your shop on the anglers’ map of Moscow',
    metaDescription:
      'Anglers in Moscow and the region already play RANGE. We show your shop on the map by the water, give players a promo code and run a “Catch of the week” in your name.',
    eyebrow: 'For fishing shops in Moscow and the region',
    lead: 'RANGE is a map game where anglers in Moscow and the region catch fish and claim sectors by rivers and ponds. We show them your shop right where they pick tackle and bait.',
    pilot: 'We are signing up shops in Moscow and the region. The first 10 days are free: we connect your shop and show how anglers find you on the map.',
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
