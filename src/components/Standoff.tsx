import { useEffect, useMemo, useRef, useState } from 'react'
import { MAX_STANDOFF_TURNS } from '../../shared/game'
import { standoffChat } from '../api/client'
import { CONSUMABLE_EFFECTS } from '../data/combat'
import { sfx } from '../audio/sfx'
import { getThemeInfo } from '../canvas/backdrop'
import { displayOpponent, localizedFame, localizedTheme } from '../i18n/content'
import { useLocale } from '../i18n/LocaleContext'
import { portraitSrc } from '../data/portraits'
import { standoffPortraitEnabled } from '../gl/flags'
import type { ChatMessage, DuelMods, Opponent, PerkId } from '../types'

interface Props {
  opponent: Opponent
  round: number
  perks?: PerkId[]
  activeBuffs?: { whiskey?: boolean; intel?: boolean }
  playerName?: string
  streak?: number
  onFinish: (mods: DuelMods, usedAi: boolean) => void
}

export function Standoff({
  opponent,
  round,
  perks = [],
  activeBuffs = {},
  playerName,
  streak = 0,
  onFinish,
}: Props) {
  const { locale, t } = useLocale()
  const face = displayOpponent(opponent, locale)
  const who = playerName || t('player.me')
  const fame = useMemo(() => localizedFame(streak, t), [streak, t])
  const themeCopy = useMemo(() => localizedTheme(round, t), [round, t])
  const themeInfo = useMemo(() => getThemeInfo(round), [round])
  const [showFace] = useState(standoffPortraitEnabled)

  useEffect(() => {
    if (activeBuffs.whiskey) {
      sfx.drink()
    }
  }, [activeBuffs.whiskey])

  const tactics = useMemo(
    () => [
      { label: t('tactic.taunt'), line: t('tactic.tauntLine'), effect: t('tactic.tauntFx') },
      { label: t('tactic.respect'), line: t('tactic.respectLine'), effect: t('tactic.respectFx') },
      { label: t('tactic.threat'), line: t('tactic.threatLine'), effect: t('tactic.threatFx') },
      { label: t('tactic.read'), line: t('tactic.readLine', { tell: face.tell }), effect: t('tactic.readFx') },
      { label: t('tactic.peace'), line: t('tactic.peaceLine'), effect: t('tactic.peaceFx') },
    ],
    [face.tell, t],
  )
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const initial: ChatMessage[] = [{ role: 'system', text: t('standoff.intro') }]
    if (activeBuffs.intel && face.personality) {
      initial.push({
        role: 'system',
        text: t('standoff.intel', { hint: face.personality }),
      })
    }
    initial.push({ role: 'opponent', text: face.taunt })
    return initial
  })
  const [input, setInput] = useState('')
  const [turn, setTurn] = useState(0)
  const [busy, setBusy] = useState(false)
  const [mods, setMods] = useState<DuelMods>({
    mood: 'calm',
    reactionDeltaMs: 0,
    accuracyDelta: 0,
    peaceEnding: false,
  })
  const [usedAi, setUsedAi] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const modsRef = useRef(mods)

  useEffect(() => {
    modsRef.current = mods
  }, [mods])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, busy])

  async function send(raw?: string) {
    const text = (raw ?? input).trim()
    if (!text || busy || turn >= MAX_STANDOFF_TURNS) return
    setBusy(true)
    setInput('')
    sfx.click()
    const nextTurn = turn + 1
    const history = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, text: m.text }))

    setMessages((m) => [...m, { role: 'player', text }])

    const result = await standoffChat({
      opponent: face,
      history,
      playerMessage: text,
      turn: nextTurn,
      round,
      streak,
      fameTitle: fame.title,
      locale,
    })

    sfx.message()
    setMessages((m) => [...m, { role: 'opponent', text: result.reply }])

    const hasPokerFace = perks.includes('poker_face')
    let addReaction = result.mods.reactionDeltaMs
    let addAccuracy = result.mods.accuracyDelta

    // 위스키 버프: 플레이어가 상대를 흔들었을 때(reactionDelta > 0) 효과 1.5배 증폭
    if (activeBuffs.whiskey && addReaction > 0) {
      addReaction = Math.round(addReaction * CONSUMABLE_EFFECTS.whiskeyPressure)
    }

    if (hasPokerFace && result.mods.mood === 'calm') {
      addReaction = Math.max(0, addReaction)
      addAccuracy = Math.min(0, addAccuracy)
    }

    const merged: DuelMods = {
      mood: result.mods.mood,
      reactionDeltaMs: modsRef.current.reactionDeltaMs + addReaction,
      accuracyDelta: modsRef.current.accuracyDelta + addAccuracy,
      peaceEnding: result.mods.peaceEnding || modsRef.current.peaceEnding,
    }
    setMods(merged)
    const aiNow = usedAi || result.usedAi
    if (result.usedAi) setUsedAi(true)
    setTurn(nextTurn)
    setBusy(false)

    if (result.mods.peaceEnding) {
      sfx.peace()
      setTimeout(() => onFinish({ ...merged, peaceEnding: true }, aiNow), 550)
    }
  }

  function goDuel() {
    sfx.click()
    onFinish(mods, usedAi)
  }

  const advantage =
    mods.reactionDeltaMs >= 20 || mods.accuracyDelta <= -0.05
      ? t('standoff.advWin')
      : mods.reactionDeltaMs <= -10 || mods.accuracyDelta >= 0.05
        ? t('standoff.advLose')
        : t('standoff.advEven')

  const done = turn >= MAX_STANDOFF_TURNS || mods.peaceEnding

  return (
    <div className={`screen standoff-screen theme-${themeInfo.skyType}`}>
      <div className="standoff-header">
        {showFace && (
          <div className="standoff-face" data-mood={mods.mood} aria-hidden>
            <img src={portraitSrc(face, round)} alt="" width={512} height={512} decoding="async" />
            <div className="standoff-face-grain" />
          </div>
        )}
        <div className="standoff-headline">
          <p className="eyebrow">
            {t('standoff.round', { round, place: themeCopy.name, turn, max: MAX_STANDOFF_TURNS })}
            {streak >= 2 && (
              <span className="standoff-fame-chip" style={{ borderColor: fame.color, color: fame.color }}>
                {fame.badge}
              </span>
            )}
          </p>
          <h2>{face.alias}</h2>
          <p className="tell-reminder">
            <span>{t('standoff.tell')}</span>
            {face.tell}
          </p>
        </div>
        <div className="mood-meter">
          <span>{t('standoff.mood')}</span>
          <strong data-mood={mods.mood}>
            {t(`mood.${mods.mood}`)}
            {mods.mood === 'suspicious' && <em className="weakness-tag">{t('standoff.weak')}</em>}
          </strong>
          <small>
            {t('standoff.now', {
              adv: advantage,
              ms: `${mods.reactionDeltaMs >= 0 ? '+' : ''}${Math.round(mods.reactionDeltaMs)}`,
              acc: `${mods.accuracyDelta >= 0 ? '+' : ''}${(mods.accuracyDelta * 100).toFixed(0)}`,
            })}
          </small>
        </div>
      </div>

      <div className="chat-log">
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            {m.role === 'player' && (
              <span className="who">
                {who}
                {streak >= 2 && <span className="bubble-fame-tag">[{fame.title}]</span>}
              </span>
            )}
            {m.role === 'opponent' && <span className="who">{face.alias}</span>}
            <p>{m.text}</p>
          </div>
        ))}
        {busy && <div className="bubble opponent typing">{t('standoff.typing')}</div>}
        <div ref={bottomRef} />
      </div>

      {!done ? (
        <>
          <div className="tactics">
            {tactics.map((t) => (
              <button
                key={t.label}
                type="button"
                className="tactic"
                disabled={busy}
                title={t.effect}
                onClick={() => void send(t.line)}
              >
                <strong>{t.label}</strong>
                <span>{t.line}</span>
              </button>
            ))}
          </div>
          <form
            className="chat-input"
            onSubmit={(e) => {
              e.preventDefault()
              void send()
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('standoff.placeholder')}
              maxLength={120}
              disabled={busy}
              autoFocus
            />
            <button className="btn primary" type="submit" disabled={busy || !input.trim()}>
              {t('standoff.speak')}
            </button>
          </form>
        </>
      ) : (
        !mods.peaceEnding && (
          <>
            <p className="hint">{t('standoff.hint')}</p>
            <button className="btn primary pulse" onClick={goDuel}>
              {t('standoff.go')}
            </button>
          </>
        )
      )}
    </div>
  )
}
