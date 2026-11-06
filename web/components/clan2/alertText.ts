import type { ClanAlert } from '@/lib/clan2/types'
import { tn, tnd } from '@/lib/i18n/runtime'

// What a clan alert says. The store keeps a kind and a short text with
// parameters («hq:2», «dock:3», «planned:Мага»); this turns it into a sentence
// in the language of the reader.
export function alertText(a: ClanAlert): string {
  const [head, tail] = [a.text.split(':')[0], a.text.includes(':') ? a.text.slice(a.text.indexOf(':') + 1) : '']
  switch (a.kind) {
    case 'sector_attack':
      if (head === 'hq') return tn('clan2.alert.hqAttack', { n: tail })
      return tail ? tn('clan2.alert.sectorAttack', { id: head, n: tail }) : tn('clan2.alert.sectorAttackPlain', { id: head })
    case 'hq_siege':
      return tn('clan2.alert.hqSiege', { clan: a.text })
    case 'hq_saved':
      return tn('clan2.alert.hqSaved', { name: a.text })
    case 'hq_fallen':
      return tn('clan2.alert.hqFallen', { id: head, n: tail || '0' })
    case 'buff':
      if (head === 'planned') return tn('clan2.alert.buffPlanned', { name: tail })
      if (head === 'started') return tn('clan2.alert.buffStarted')
      if (head === 'cancelled') return tn('clan2.alert.buffCancelled')
      return tn('clan2.alert.buffEnded', { n: tail })
    case 'nudge':
      if (head === 'leader') return tn('clan2.alert.leader', { name: tail })
      if (head === 'autoleader') return tn('clan2.alert.autoLeader', { name: tail })
      return tn('clan2.alert.nudge', { name: a.text })
    case 'quest_done':
      return tn('clan2.alert.questDone')
    case 'project_done':
      if (a.text.startsWith('skin_') || a.text.startsWith('boat_') || a.text.startsWith('banner_')) return tn('clan2.alert.bought', { name: tnd(`clan2.goal.${a.text}`) })
      return tn('clan2.alert.project', { name: tnd(`clan2.project.${head}.name`), n: tail || '1' })
    case 'recruit':
      if (head === 'joined') return tn('clan2.alert.joined')
      return tn('clan2.alert.recruitPaid', { name: tail })
    default:
      return a.text
  }
}
