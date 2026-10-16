import { tnd } from '@/lib/i18n/runtime'
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
    get label() {
      return tnd('emojiGroup.smileys')
    },
    icon: '😀',
    emoji: list(
      '😀 😃 😄 😁 😆 😅 😂 🤣 ☺️ 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😝 😜 🤪 🤨 🧐 🤓 😎 🤩 🥳 😏 😒 😞 😔 😟 😕 🙁 ☹️ 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🤗 🤔 🤭 🤫 🤥 😶 😐 😑 😬 🙄 😯 😦 😧 😮 😲 🥱 😴 🤤 😪 😵 🤐 🥴 🤢 🤮 🤧 😷 🤒 🤕 🤑 🤠 😈 👿 🤡 💩 👻 💀 👽 🤖 🎃 😺 😸 😹 😻 😼 😽 🙀 😿 😾'
    ),
  },
  {
    id: 'gestures',
    get label() {
      return tnd('emojiGroup.gestures')
    },
    icon: '👍',
    emoji: list(
      '👍 👎 👌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ ✋ 🤚 🖐️ 🖖 👋 👏 🙌 👐 🤲 🤝 🙏 ✊ 👊 🤛 🤜 💪 🦾 ✍️ 💅 🤳 👀 👁️ 🧠 👅 👄 🙋 🙆 🙅 🤷 🤦 🙇 💁 🙎 🙍 🧏 🏃 🚶 🧍 🧎 🕺 💃 👨‍🍳 🧙 🧛 🧜 🎅 👑 🎓'
    ),
  },
  {
    id: 'nature',
    get label() {
      return tnd('emojiGroup.nature')
    },
    icon: '🐟',
    emoji: list(
      '🐟 🐠 🐡 🦈 🐙 🦑 🦀 🦞 🦐 🐬 🐳 🐋 🐊 🐢 🐸 🦆 🦢 🦩 🐧 🕊️ 🦅 🦉 🐦 🐤 🐓 🦦 🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐵 🙈 🙉 🙊 🐴 🦄 🐝 🐛 🦋 🐌 🐞 🐜 🦟 🕷️ 🦂 🐍 🦎 🐚 🌊 💧 🌵 🎄 🌲 🌳 🌴 🌱 🌿 ☘️ 🍀 🍁 🍂 🍃 🌾 🌺 🌻 🌹 🌷 🌼 🌸 💐 🍄 ☀️ 🌤️ ⛅ 🌥️ ☁️ 🌦️ 🌧️ ⛈️ 🌩️ 🌨️ ❄️ ☃️ ⛄ 🌬️ 💨 🌪️ 🌫️ 🌈 ☔ ⚡ 🔥 🌙 ⭐ 🌟 ✨ 🌍'
    ),
  },
  {
    id: 'food',
    get label() {
      return tnd('emojiGroup.food')
    },
    icon: '🍎',
    emoji: list(
      '🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🍆 🥑 🥦 🥬 🥒 🌶️ 🌽 🥕 🧄 🧅 🥔 🍠 🥐 🍞 🥖 🧀 🥚 🍳 🥓 🥩 🍗 🍖 🌭 🍔 🍟 🍕 🥪 🌮 🌯 🥗 🍝 🍜 🍲 🍣 🍤 🍙 🍚 🍢 🍡 🍧 🍨 🍦 🥧 🧁 🍰 🎂 🍫 🍬 🍭 🍯 🍩 🍪 🥜 ☕ 🍵 🧃 🥤 🍺 🍻 🥂 🍷 🥃 🍸 🍹 🧊'
    ),
  },
  {
    id: 'activity',
    get label() {
      return tnd('emojiGroup.activity')
    },
    icon: '🎣',
    emoji: list(
      '🎣 🏆 🥇 🥈 🥉 🏅 🎖️ 🎯 🛶 🚣 🏊 🏄 🤽 🧗 🚴 🏕️ ⛺ ⚽ 🏀 🏈 ⚾ 🎾 🏐 🏉 🎱 🏓 🏸 🥊 🥋 🎳 ⛳ 🎮 🎲 🧩 🎨 🎸 🎹 🎤 🎧 🎬 🎉 🎊 🎈 🎁 🎗️ 🎟️'
    ),
  },
  {
    id: 'travel',
    get label() {
      return tnd('emojiGroup.travel')
    },
    icon: '⛵',
    emoji: list(
      '⛵ 🚤 🛥️ 🚢 ⚓ 🗺️ 🧭 🏖️ 🏝️ 🏞️ 🌅 🌄 🌇 🌉 🏔️ ⛰️ 🌋 🗻 🏠 🏡 🏘️ 🏙️ 🚗 🚕 🚙 🚌 🚎 🏎️ 🚓 🚑 🚒 🚚 🚜 🏍️ 🛵 🚲 🛴 🚂 🚆 ✈️ 🚁 🚀 🛸 ⛽ 🚦 🗽 🗼 🏰 🎡 🎢 ⛲'
    ),
  },
  {
    id: 'objects',
    get label() {
      return tnd('emojiGroup.objects')
    },
    icon: '💡',
    emoji: list(
      '⌚ 📱 💻 🖥️ 📷 📸 📹 🎥 📞 ☎️ 📺 📻 🔦 🕯️ 💡 🔋 🔌 💰 💵 💸 💳 💎 ⚖️ 🔧 🔨 ⚒️ 🛠️ ⛏️ 🔩 ⚙️ 🧲 🔫 🧨 🔪 🗡️ 🛡️ 🔮 🧿 💊 💉 🧪 🌡️ 🧹 🧺 🧻 🧼 🧽 🔑 🗝️ 🚪 🛏️ 🧸 🎒 👓 🕶️ 🧢 👒 🎩 🧥 👕 👖 🩳 🧦 👟 🥾 ⛑️ 🚬 📦 📫 ✏️ 📝 📌 📍 ✂️ 🔒 🔓 🗑️ ⏰ ⏳ 🔔 📣'
    ),
  },
  {
    id: 'symbols',
    get label() {
      return tnd('emojiGroup.symbols')
    },
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
