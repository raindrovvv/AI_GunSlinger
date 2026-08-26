import { TOTAL_ROUNDS } from '../../shared/game'
import { rewardFor } from '../data/combat'
import { rollPerkChoices } from '../data/perks'
import { FALLBACK_OPPONENTS } from '../data/fallback'
import { previewCareer, previewRun, PREVIEW_PERKS, type PreviewState } from '../data/preview'
import type {
  ActiveBuffs,
  CareerStats,
  ConsumableId,
  DuelMods,
  DuelOutcome,
  GamePhase,
  NewspaperArticle,
  Opponent,
  PerkId,
  RunRecord,
} from '../types'

export const EMPTY_MODS: DuelMods = {
  mood: 'calm',
  reactionDeltaMs: 0,
  accuracyDelta: 0,
  peaceEnding: false,
}

export interface AiFlags {
  opponent: boolean
  chat: boolean
  paper: boolean
}

export interface RunState {
  phase: GamePhase
  loadingText: string
  playerName: string
  round: number
  opponent: Opponent | null
  mods: DuelMods
  article: NewspaperArticle | null
  playerWon: boolean
  peace: boolean
  wins: number
  peaces: number
  prevNames: string[]
  aiFlags: AiFlags
  perks: PerkId[]
  perkChoices: PerkId[]
  pickedPerk: PerkId | null
  activeBuffs: ActiveBuffs
  streak: number
  bounty: number
  lastReward: number
  lastOutcome: DuelOutcome | null
  endingCareer: CareerStats | null
  endingRun: RunRecord | null
  bestReactionMs: number | null
  bestStreak: number
}

const EMPTY_AI: AiFlags = { opponent: false, chat: false, paper: false }

export function createInitialRun(playerName: string, preview: PreviewState | null): RunState {
  const isPreview = preview != null
  const defeat = preview?.kind === 'defeat'
  const victory = preview?.kind === 'victory' || preview?.kind === 'cutscene'
  const opponent =
    preview?.kind === 'round'
      ? (FALLBACK_OPPONENTS[preview.round - 1] ?? FALLBACK_OPPONENTS[0])
      : (preview?.opponent ?? null)

  return {
    phase: preview?.phase ?? 'title',
    loadingText: '수배서를 인쇄하는 중…',
    playerName,
    round: preview?.round ?? 1,
    opponent,
    mods: EMPTY_MODS,
    article: null,
    playerWon: victory,
    peace: false,
    wins: isPreview ? (defeat ? 4 : 8) : 0,
    peaces: isPreview ? 1 : 0,
    prevNames: [],
    aiFlags: EMPTY_AI,
    perks: isPreview ? [...PREVIEW_PERKS] : [],
    perkChoices: [],
    pickedPerk: null,
    activeBuffs: {},
    streak: isPreview ? (defeat ? 0 : 9) : 0,
    bounty: isPreview ? 248500 : 0,
    lastReward: 0,
    lastOutcome: null,
    endingCareer: isPreview ? previewCareer() : null,
    endingRun: preview ? previewRun(preview.kind) : null,
    bestReactionMs: isPreview ? 214 : null,
    bestStreak: isPreview ? (defeat ? 4 : 9) : 0,
  }
}

export type RunAction =
  | { type: 'START_RUN'; playerName?: string }
  | { type: 'LOADING'; text: string }
  | { type: 'ROUND_READY'; opponent: Opponent; usedAi: boolean }
  | { type: 'SET_PHASE'; phase: GamePhase }
  | { type: 'STANDOFF_DONE'; mods: DuelMods; usedAi: boolean }
  | { type: 'COMMIT'; state: RunState }
  | { type: 'NEWSPAPER_READY'; article: NewspaperArticle; usedAi: boolean }
  | { type: 'PICK_PERK'; id: PerkId }
  | { type: 'BUY_CONSUMABLE'; id: ConsumableId; cost: number }
  | { type: 'BUY_PERK'; id: PerkId; cost: number }
  | { type: 'SPEND_BOUNTY'; amount: number }
  | { type: 'ADVANCE_ROUND' }
  | { type: 'END_RUN'; career: CareerStats; run: RunRecord; victory: boolean }

export function applyEncounter(
  state: RunState,
  p: {
    won: boolean
    isPeace: boolean
    outcome: DuelOutcome | null
    opponent: Opponent
    loadingText?: string
  },
): RunState {
  const nextStreak = p.won ? state.streak + 1 : 0
  let bestStreak = state.bestStreak
  if (nextStreak > bestStreak) bestStreak = nextStreak

  let bestReactionMs = state.bestReactionMs
  if (p.outcome?.reactionMs != null && p.outcome.reactionMs > 0) {
    if (bestReactionMs == null || p.outcome.reactionMs < bestReactionMs) {
      bestReactionMs = p.outcome.reactionMs
    }
  }

  const wins = !p.isPeace && p.won ? state.wins + 1 : state.wins
  const peaces = p.isPeace ? state.peaces + 1 : state.peaces
  const reward = p.won ? rewardFor(p.opponent, p.outcome, p.isPeace, nextStreak, state.perks) : 0
  const canPick = p.won && state.round < TOTAL_ROUNDS

  return {
    ...state,
    streak: nextStreak,
    bestStreak,
    bestReactionMs,
    playerWon: p.won,
    peace: p.isPeace,
    lastOutcome: p.outcome,
    wins,
    peaces,
    lastReward: reward,
    bounty: reward > 0 ? state.bounty + reward : state.bounty,
    perkChoices: canPick ? rollPerkChoices(state.perks, 3) : [],
    pickedPerk: null,
    activeBuffs: {},
    phase: 'loading',
    loadingText: p.loadingText ?? '신문 조달 및 인쇄 중…',
  }
}

export function runReducer(state: RunState, action: RunAction): RunState {
  switch (action.type) {
    case 'START_RUN': {
      const playerName = action.playerName?.trim() || state.playerName
      return {
        ...createInitialRun(playerName, null),
        playerName,
        phase: 'loading',
        loadingText: 'AI가 새로운 무법자를 쓰는 중…',
      }
    }
    case 'LOADING':
      return { ...state, phase: 'loading', loadingText: action.text }
    case 'ROUND_READY':
      return {
        ...state,
        opponent: action.opponent,
        prevNames: [...state.prevNames, action.opponent.name, action.opponent.alias],
        aiFlags: { ...state.aiFlags, opponent: action.usedAi },
        mods: EMPTY_MODS,
        perkChoices: [],
        pickedPerk: null,
        lastOutcome: null,
        phase: 'wanted',
      }
    case 'SET_PHASE':
      return { ...state, phase: action.phase }
    case 'STANDOFF_DONE':
      return {
        ...state,
        mods: action.mods,
        aiFlags: { ...state.aiFlags, chat: action.usedAi },
        phase: action.mods.peaceEnding ? state.phase : 'duel',
      }
    case 'COMMIT':
      return action.state
    case 'NEWSPAPER_READY':
      return {
        ...state,
        article: action.article,
        aiFlags: { ...state.aiFlags, paper: action.usedAi },
        phase: 'newspaper',
      }
    case 'PICK_PERK':
      if (state.pickedPerk || state.perks.includes(action.id)) return state
      return {
        ...state,
        pickedPerk: action.id,
        perks: [...state.perks, action.id],
      }
    case 'BUY_CONSUMABLE':
      if (state.bounty < action.cost || state.activeBuffs[action.id]) return state
      return {
        ...state,
        bounty: state.bounty - action.cost,
        activeBuffs: { ...state.activeBuffs, [action.id]: true },
      }
    case 'BUY_PERK':
      if (state.bounty < action.cost || state.perks.includes(action.id)) return state
      return {
        ...state,
        bounty: state.bounty - action.cost,
        perks: [...state.perks, action.id],
      }
    case 'SPEND_BOUNTY':
      if (state.bounty < action.amount) return state
      return { ...state, bounty: state.bounty - action.amount }
    case 'ADVANCE_ROUND':
      return { ...state, round: state.round + 1 }
    case 'END_RUN':
      return {
        ...state,
        endingCareer: action.career,
        endingRun: action.run,
        phase: action.victory ? 'cutscene' : 'gameover',
      }
    default:
      return state
  }
}
