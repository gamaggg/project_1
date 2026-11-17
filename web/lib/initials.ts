// Letters for an avatar without a photo. Counted by whole characters, not
// UTF-16 halves: a name starting with an emoji or a «𝙏»-style letter, cut by
// .slice(0, 1), drew half a character as a box (17.11.2026). NFKC turns such
// letters into plain ones (𝙏 → T), the same as the database does to names.
export function nameInitials(name: string, count: 1 | 2 = 2): string {
  return Array.from(name.normalize('NFKC')).slice(0, count).join('').toUpperCase()
}
