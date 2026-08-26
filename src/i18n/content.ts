import { CONSUMABLE_EFFECTS, PERK_EFFECTS, percentFromScale } from '../data/combat'
import { getFameInfo, type FameInfo } from '../data/fame'
import { CONSUMABLE_ITEMS } from '../data/shop'
import type { ConsumableId, ConsumableItem, Opponent, Perk, PerkId } from '../types'
import type { Translator } from './types'

const EN_FALLBACK: Record<string, Pick<Opponent, 'name' | 'alias' | 'crime' | 'appearance' | 'tell' | 'personality' | 'taunt'>> = {
  'fb-1': {
    name: 'Billy Carson',
    alias: 'Rusty Trigger',
    crime: 'Swapped poker hands in the saloon and ran',
    appearance: 'A worn cowboy hat, a rusted iron, stubble like sand',
    tell: 'When the nerves hit, the left thumb taps the holster',
    personality: 'All bluff, easy to rile. Cusses get under the skin.',
    taunt: 'I will fire before that iron of yours rusts through.',
  },
  'fb-2': {
    name: 'Rosa Beltran',
    alias: 'Widow of the Dust',
    crime: 'Dropped ten gunmen in the name of a dead husband',
    appearance: 'A black veil, silver iron, a cold stare',
    tell: 'She bites her lip a hair before the draw',
    personality: 'Cold and exact. Feeling does not land. Logic and respect do.',
    taunt: 'One grave left empty… is it yours?',
  },
  'fb-3': {
    name: 'Rex Morrigan',
    alias: "Lyin' Rex",
    crime: 'Sold shares in a gold mine that never was',
    appearance: 'A loud vest, a gold tooth, a smile that never dies',
    tell: 'The right brow climbs when the lie starts',
    personality: 'A master of wind. Pin him to the truth and he folds.',
    taunt: 'Your odds? I already did the sum. Zero.',
  },
  'fb-4': {
    name: 'Silva Carter',
    alias: 'Silent Shade',
    crime: 'Won twelve duels without speaking a word',
    appearance: 'A black poncho, a scarf over most of the face, a long shadow',
    tell: 'The left boot slips back a hair before the draw',
    personality: 'Almost mute. Short answers. Respect and silence move them.',
    taunt: '….',
  },
  'fb-5': {
    name: 'John Crawford',
    alias: 'Calculator John',
    crime: 'Hunted only the fights the numbers favored',
    appearance: 'Spectacles, a notebook, two irons, a restless hand',
    tell: 'Mutters numbers and taps a beat with the fingers',
    personality: 'Sees odds in everything. Logic and the unexpected break him.',
    taunt: 'Your odds of living: 12.4%. I do not even round.',
  },
  'fb-6': {
    name: 'Marie Delacruz',
    alias: 'Hex Witch',
    crime: 'Whispered a charm that made irons misfire',
    appearance: 'A worn cloak, charms, a smoking pistol',
    tell: 'Whispers a short charm before the draw',
    personality: 'Strange and changeable. Humor and odd talk catch her.',
    taunt: 'I already hexed that trigger. Pull it.',
  },
  'fb-7': {
    name: 'Henry Ward',
    alias: 'Crooked Star',
    crime: 'A former sheriff who hanged the innocent in the name of law',
    appearance: 'A torn star, a blood-spotted coat, a hard face',
    tell: 'Touches the badge without knowing, just before the draw',
    personality: 'Believes his own justice. Conscience makes him shake.',
    taunt: 'The law follows after I fire.',
  },
  'fb-8': {
    name: 'Marcus Steel',
    alias: 'Iron Arm',
    crime: 'Started duels with no order and burned a town',
    appearance: 'A machine arm, one glowing eye, a metal holster',
    tell: 'The eye blinks blue just before the draw',
    personality: 'Cold machine logic. Feeling is noise. A contradiction stalls him.',
    taunt: 'Feeling is lag. You already lost.',
  },
  'fb-9': {
    name: 'Nameless Drifter',
    alias: 'Last Outlaw',
    crime: 'Tried to write the whole West as one simulation',
    appearance: 'Plain clothes, a smile too clean, no shadow',
    tell: 'None. Or every move is the tell.',
    personality: 'Sees all, kind in a terrible way. Peace may be the only road.',
    taunt: 'This duel, and you, are already a line I wrote.',
  },
}

function fallbackKey(id: string) {
  const m = id.match(/^fb-(\d)/)
  if (m) return `fb-${m[1]}`
  if (id.startsWith('boss') || id.includes('fb-9')) return 'fb-9'
  return id
}

export function displayOpponent(opponent: Opponent, locale: 'ko' | 'en'): Opponent {
  if (locale !== 'en') return opponent
  const key = fallbackKey(opponent.id)
  const copy = EN_FALLBACK[key]
  if (!copy) return opponent
  return { ...opponent, ...copy }
}

export function localizedPerk(id: PerkId, t: Translator): Perk {
  const vars =
    id === 'keen'
      ? { n: percentFromScale(PERK_EFFECTS.keenHitScale) }
      : id === 'fast'
        ? { n: PERK_EFFECTS.fastGraceMs }
        : id === 'charm'
          ? { n: PERK_EFFECTS.charmDelayMs }
          : id === 'golden_spur'
            ? { n: percentFromScale(PERK_EFFECTS.goldenSpurMult) }
            : undefined
  return {
    id,
    name: t(`perk.${id}.name`),
    desc: t(`perk.${id}.desc`, vars),
  }
}

export function localizedItem(id: ConsumableId, t: Translator): ConsumableItem {
  const base = CONSUMABLE_ITEMS.find((c) => c.id === id)!
  const vars =
    id === 'whiskey'
      ? { n: Math.round((CONSUMABLE_EFFECTS.whiskeyPressure - 1) * 100) }
      : id === 'smoke'
        ? { n: Math.round(CONSUMABLE_EFFECTS.smokeAccuracy * 100) }
        : id === 'powder'
          ? { n: percentFromScale(CONSUMABLE_EFFECTS.powderHeadScale) }
          : undefined
  return {
    ...base,
    name: t(`item.${id}.name`),
    desc: t(`item.${id}.desc`, vars),
  }
}

export function localizedFame(streak: number, t: Translator): FameInfo {
  const base = getFameInfo(streak)
  return {
    ...base,
    title: t(`fame.${base.grade}.title`),
    subtitle: t(`fame.${base.grade}.sub`),
    badge: t(`fame.${base.grade}.badge`),
    promptDesc: t(`fame.${base.grade}.prompt`),
  }
}

export function localizedTheme(round: number, t: Translator) {
  const r = Math.max(1, Math.min(9, round))
  return {
    name: t(`theme.${r}.name`),
    subtitle: t(`theme.${r}.sub`),
  }
}
