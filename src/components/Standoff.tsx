import { useEffect, useMemo, useRef, useState } from 'react'
import { standoffChat } from '../api/client'
import { sfx } from '../audio/sfx'
import { getFameInfo } from '../data/fame'
import { getThemeInfo } from '../canvas/backdrop'
import type { ChatMessage, DuelMods, MoodShift, Opponent, PerkId } from '../types'

interface Props {
  opponent: Opponent
  round: number
  perks?: PerkId[]
  activeBuffs?: { whiskey?: boolean; intel?: boolean }
  playerName?: string
  streak?: number
  onFinish: (mods: DuelMods, usedAi: boolean) => void
}

const MAX_TURNS = 3

const MOOD_LABEL: Record<MoodShift, string> = {
  calm: '평정',
  intimidated: '위축',
  angered: '분노',
  scared: '공포',
  suspicious: '경계',
}

export function Standoff({
  opponent,
  round,
  perks = [],
  activeBuffs = {},
  playerName = '나',
  streak = 0,
  onFinish,
}: Props) {
  const fame = useMemo(() => getFameInfo(streak), [streak])
  const themeInfo = useMemo(() => getThemeInfo(round), [round])

  useEffect(() => {
    if (activeBuffs.whiskey) {
      sfx.drink()
    }
  }, [activeBuffs.whiskey])

  const tactics = useMemo(
    () => [
      {
        label: '도발',
        line: '소문보다 손이 느려 보이는군.',
        effect: '분노 — 드로우는 빨라지지만 조준이 크게 흔들린다',
      },
      {
        label: '존중',
        line: '실력은 인정한다. 그래도 물러설 순 없어.',
        effect: '위축 — 상대의 손이 무거워진다',
      },
      {
        label: '협박',
        line: '오늘 관에 들어갈 사람은 내가 아니야.',
        effect: '공포 — 크게 흔들린다',
      },
      {
        label: '간파',
        line: `${opponent.tell}… 다 보인다.`,
        effect: '경계 — 수배서의 버릇을 짚어 크게 동요시킨다',
      },
      {
        label: '화해',
        line: '총 내려놓고 술이나 한잔 하자고.',
        effect: '설득 — 3턴째라면 결투를 피할 수도 있다',
      },
    ],
    [opponent.tell],
  )
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const initial: ChatMessage[] = [
      {
        role: 'system',
        text: '드로우 직전 버릇을 짚거나, 도발·존중·협박·화해로 심리를 흔들어라. 흔들린 만큼 상대의 손이 느려진다.',
      },
    ]
    if (activeBuffs.intel && opponent.personality) {
      initial.push({
        role: 'system',
        text: `📜 [정보상 밀서]: 상대의 성격과 약점은 "${opponent.personality}" 이다. 이를 파고들어라!`,
      })
    }
    initial.push({ role: 'opponent', text: opponent.taunt })
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
    if (!text || busy || turn >= MAX_TURNS) return
    setBusy(true)
    setInput('')
    sfx.click()
    const nextTurn = turn + 1
    const history = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, text: m.text }))

    setMessages((m) => [...m, { role: 'player', text }])

    const result = await standoffChat({
      opponent,
      history,
      playerMessage: text,
      turn: nextTurn,
      round,
      streak,
      fameTitle: fame.title,
    })

    sfx.message()
    setMessages((m) => [...m, { role: 'opponent', text: result.reply }])

    const hasPokerFace = perks.includes('poker_face')
    let addReaction = result.mods.reactionDeltaMs
    let addAccuracy = result.mods.accuracyDelta

    // 위스키 버프: 플레이어가 상대를 흔들었을 때(reactionDelta > 0) 효과 1.5배 증폭
    if (activeBuffs.whiskey && addReaction > 0) {
      addReaction = Math.round(addReaction * 1.5)
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
      setTimeout(() => onFinish({ ...merged, peaceEnding: true }, aiNow), 2600)
    }
  }

  function goDuel() {
    sfx.click()
    onFinish(mods, usedAi)
  }

  const advantage =
    mods.reactionDeltaMs >= 20 || mods.accuracyDelta <= -0.05
      ? '유리'
      : mods.reactionDeltaMs <= -10 || mods.accuracyDelta >= 0.05
        ? '불리'
        : '팽팽'

  const done = turn >= MAX_TURNS || mods.peaceEnding

  return (
    <div className={`screen standoff-screen theme-${themeInfo.skyType}`}>
      <div className="standoff-header">
        <div>
          <p className="eyebrow">
            ROUND {round} · 📍 {themeInfo.name} · 대치 {turn}/{MAX_TURNS}턴
            {streak >= 2 && (
              <span className="standoff-fame-chip" style={{ borderColor: fame.color, color: fame.color }}>
                {fame.badge}
              </span>
            )}
          </p>
          <h2>{opponent.alias}</h2>
          <p className="tell-reminder">
            <span>드로우 직전 버릇</span>
            {opponent.tell}
          </p>
        </div>
        <div className="mood-meter">
          <span>상대 심리</span>
          <strong data-mood={mods.mood}>
            {MOOD_LABEL[mods.mood]}
            {mods.mood === 'suspicious' && <em className="weakness-tag">약점 간파!</em>}
          </strong>
          <small>
            지금은 <b>{advantage}</b> · 상대 반응 {mods.reactionDeltaMs >= 0 ? '+' : ''}
            {Math.round(mods.reactionDeltaMs)}ms · 명중{' '}
            {(mods.accuracyDelta >= 0 ? '+' : '') + (mods.accuracyDelta * 100).toFixed(0)}%
          </small>
        </div>
      </div>

      <div className="chat-log">
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            {m.role === 'player' && (
              <span className="who">
                {playerName}
                {streak >= 2 && <span className="bubble-fame-tag">[{fame.title}]</span>}
              </span>
            )}
            {m.role === 'opponent' && <span className="who">{opponent.alias}</span>}
            <p>{m.text}</p>
          </div>
        ))}
        {busy && <div className="bubble opponent typing">상대가 입을 연다…</div>}
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
              placeholder="직접 말하기 — 무슨 말이든 상대가 반응한다"
              maxLength={120}
              disabled={busy}
              autoFocus
            />
            <button className="btn primary" type="submit" disabled={busy || !input.trim()}>
              말하기
            </button>
          </form>
        </>
      ) : (
        !mods.peaceEnding && (
          <>
            <p className="hint">말은 끝났다. 이제 손이 말할 차례다.</p>
            <button className="btn primary pulse" onClick={goDuel}>
              결투로
            </button>
          </>
        )
      )}
    </div>
  )
}
