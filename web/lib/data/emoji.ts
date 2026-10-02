// The clan chat's emoji panel (EmojiPanel.tsx). Plain Unicode emoji, so each
// phone draws them in its own style — Apple's on an iPhone, Google's on
// Android — exactly like its own keyboard. Kept to Emoji 12 and older so
// nothing shows up as an empty box on an older phone; no skin-tone variants
// or flags, to keep the grid short.

export type EmojiCategory = { id: string; label: string; icon: string; emoji: string[] }

const list = (s: string) => s.split(' ').filter(Boolean)

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: 'smileys',
    label: 'Смайлы',
    icon: '😀',
    emoji: list(
      '😀 😃 😄 😁 😆 😅 😂 🤣 ☺️ 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😝 😜 🤪 🤨 🧐 🤓 😎 🤩 🥳 😏 😒 😞 😔 😟 😕 🙁 ☹️ 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🤗 🤔 🤭 🤫 🤥 😶 😐 😑 😬 🙄 😯 😦 😧 😮 😲 🥱 😴 🤤 😪 😵 🤐 🥴 🤢 🤮 🤧 😷 🤒 🤕 🤑 🤠 😈 👿 🤡 💩 👻 💀 👽 🤖 🎃 😺 😸 😹 😻 😼 😽 🙀 😿 😾'
    ),
  },
  {
    id: 'gestures',
    label: 'Жесты и люди',
    icon: '👍',
    emoji: list(
      '👍 👎 👌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ ✋ 🤚 🖐️ 🖖 👋 👏 🙌 👐 🤲 🤝 🙏 ✊ 👊 🤛 🤜 💪 🦾 ✍️ 💅 🤳 👀 👁️ 🧠 👅 👄 🙋 🙆 🙅 🤷 🤦 🙇 💁 🙎 🙍 🧏 🏃 🚶 🧍 🧎 🕺 💃 👨‍🍳 🧙 🧛 🧜 🎅 👑 🎓'
    ),
  },
  {
    id: 'nature',
    label: 'Рыбы, животные, природа',
    icon: '🐟',
    emoji: list(
      '🐟 🐠 🐡 🦈 🐙 🦑 🦀 🦞 🦐 🐬 🐳 🐋 🐊 🐢 🐸 🦆 🦢 🦩 🐧 🕊️ 🦅 🦉 🐦 🐤 🐓 🦦 🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐵 🙈 🙉 🙊 🐴 🦄 🐝 🐛 🦋 🐌 🐞 🐜 🦟 🕷️ 🦂 🐍 🦎 🐚 🌊 💧 🌵 🎄 🌲 🌳 🌴 🌱 🌿 ☘️ 🍀 🍁 🍂 🍃 🌾 🌺 🌻 🌹 🌷 🌼 🌸 💐 🍄 ☀️ 🌤️ ⛅ 🌥️ ☁️ 🌦️ 🌧️ ⛈️ 🌩️ 🌨️ ❄️ ☃️ ⛄ 🌬️ 💨 🌪️ 🌫️ 🌈 ☔ ⚡ 🔥 🌙 ⭐ 🌟 ✨ 🌍'
    ),
  },
  {
    id: 'food',
    label: 'Еда и напитки',
    icon: '🍎',
    emoji: list(
      '🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🍆 🥑 🥦 🥬 🥒 🌶️ 🌽 🥕 🧄 🧅 🥔 🍠 🥐 🍞 🥖 🧀 🥚 🍳 🥓 🥩 🍗 🍖 🌭 🍔 🍟 🍕 🥪 🌮 🌯 🥗 🍝 🍜 🍲 🍣 🍤 🍙 🍚 🍢 🍡 🍧 🍨 🍦 🥧 🧁 🍰 🎂 🍫 🍬 🍭 🍯 🍩 🍪 🥜 ☕ 🍵 🧃 🥤 🍺 🍻 🥂 🍷 🥃 🍸 🍹 🧊'
    ),
  },
  {
    id: 'activity',
    label: 'Рыбалка и спорт',
    icon: '🎣',
    emoji: list(
      '🎣 🏆 🥇 🥈 🥉 🏅 🎖️ 🎯 🛶 🚣 🏊 🏄 🤽 🧗 🚴 🏕️ ⛺ ⚽ 🏀 🏈 ⚾ 🎾 🏐 🏉 🎱 🏓 🏸 🥊 🥋 🎳 ⛳ 🎮 🎲 🧩 🎨 🎸 🎹 🎤 🎧 🎬 🎉 🎊 🎈 🎁 🎗️ 🎟️'
    ),
  },
  {
    id: 'travel',
    label: 'Транспорт и места',
    icon: '⛵',
    emoji: list(
      '⛵ 🚤 🛥️ 🚢 ⚓ 🗺️ 🧭 🏖️ 🏝️ 🏞️ 🌅 🌄 🌇 🌉 🏔️ ⛰️ 🌋 🗻 🏠 🏡 🏘️ 🏙️ 🚗 🚕 🚙 🚌 🚎 🏎️ 🚓 🚑 🚒 🚚 🚜 🏍️ 🛵 🚲 🛴 🚂 🚆 ✈️ 🚁 🚀 🛸 ⛽ 🚦 🗽 🗼 🏰 🎡 🎢 ⛲'
    ),
  },
  {
    id: 'objects',
    label: 'Предметы',
    icon: '💡',
    emoji: list(
      '⌚ 📱 💻 🖥️ 📷 📸 📹 🎥 📞 ☎️ 📺 📻 🔦 🕯️ 💡 🔋 🔌 💰 💵 💸 💳 💎 ⚖️ 🔧 🔨 ⚒️ 🛠️ ⛏️ 🔩 ⚙️ 🧲 🔫 🧨 🔪 🗡️ 🛡️ 🔮 🧿 💊 💉 🧪 🌡️ 🧹 🧺 🧻 🧼 🧽 🔑 🗝️ 🚪 🛏️ 🧸 🎒 👓 🕶️ 🧢 👒 🎩 🧥 👕 👖 🩳 🧦 👟 🥾 ⛑️ 🚬 📦 📫 ✏️ 📝 📌 📍 ✂️ 🔒 🔓 🗑️ ⏰ ⏳ 🔔 📣'
    ),
  },
  {
    id: 'symbols',
    label: 'Символы',
    icon: '❤️',
    emoji: list(
      '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💯 💢 💥 💫 💦 💤 ✅ ☑️ ✔️ ❌ ❎ ➕ ➖ ❗ ❓ ‼️ ⁉️ ⚠️ 🚫 ⛔ 🆗 🆒 🆕 🆙 🔝 🔜 ♻️ ⚜️ 🔱 🔰 ⭕ 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ 🟤 🔺 🔻 🔷 🔶 ➡️ ⬅️ ⬆️ ⬇️ ↗️ ↘️ 🔄 🎵 🎶 ➰ 〰️'
    ),
  },
]

// A message that is nothing but 1–3 emoji is shown big, without a bubble —
// the way Telegram shows a lone emoji.
export const BIG_EMOJI_MAX = 3

const PICTO = /\p{Extended_Pictographic}/u

export function bigEmojiCount(text: string): number {
  const t = text.trim()
  if (!t || t.length > 40) return 0
  const Segmenter = (Intl as unknown as { Segmenter?: new (l: string, o: { granularity: 'grapheme' }) => { segment(s: string): Iterable<{ segment: string }> } }).Segmenter
  if (!Segmenter) return 0
  let count = 0
  for (const { segment } of new Segmenter('ru', { granularity: 'grapheme' }).segment(t)) {
    if (/^\s+$/.test(segment)) continue
    if (!PICTO.test(segment)) return 0
    count++
    if (count > BIG_EMOJI_MAX) return 0
  }
  return count
}
