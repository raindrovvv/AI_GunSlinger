import { useState } from 'react'
import { sfx } from '../audio/sfx'
import { CONSUMABLE_ITEMS, PERK_BUY_PRICE, PERK_REROLL_PRICE } from '../data/shop'
import { perkById, rollPerkChoices } from '../data/perks'
import { PerkIcon } from './PerkIcon'
import type { ActiveBuffs, ConsumableId, PerkId } from '../types'

interface Props {
  round: number
  bounty: number
  perks: PerkId[]
  activeBuffs: ActiveBuffs
  onBuyConsumable: (id: ConsumableId, cost: number) => void
  onBuyPerk: (id: PerkId, cost: number) => void
  onSpendBounty: (amount: number) => boolean
  onNext: () => void
}

export function Store({
  round,
  bounty,
  perks,
  activeBuffs,
  onBuyConsumable,
  onBuyPerk,
  onSpendBounty,
  onNext,
}: Props) {
  const [shopPerks, setShopPerks] = useState<PerkId[]>(() => rollPerkChoices(perks, 3))
  const [storeMessage, setStoreMessage] = useState<string | null>(null)

  const showMsg = (msg: string) => {
    setStoreMessage(msg)
    setTimeout(() => setStoreMessage(null), 2500)
  }

  const handleBuyConsumable = (id: ConsumableId, price: number) => {
    if (activeBuffs[id]) {
      showMsg('이미 해당 보급품을 보유하고 있습니다.')
      return
    }
    if (bounty < price) {
      sfx.warn()
      showMsg('현상금이 부족합니다! 무법자를 더 잡고 오시오.')
      return
    }
    sfx.coin()
    onBuyConsumable(id, price)
    showMsg('구매 완료! 다음 라운드에 즉시 발동됩니다.')
  }

  const handleBuyPerk = (id: PerkId) => {
    if (perks.includes(id)) {
      showMsg('이미 장착 중인 전리품입니다.')
      return
    }
    if (bounty < PERK_BUY_PRICE) {
      sfx.warn()
      showMsg('현상금이 부족합니다!')
      return
    }
    sfx.coin()
    onBuyPerk(id, PERK_BUY_PRICE)
    setShopPerks((prev) => prev.filter((p) => p !== id))
    showMsg('특수 전리품을 획득했습니다!')
  }

  const handleRerollPerks = () => {
    if (bounty < PERK_REROLL_PRICE) {
      sfx.warn()
      showMsg('새로고침을 위한 $200가 부족합니다.')
      return
    }
    if (onSpendBounty(PERK_REROLL_PRICE)) {
      sfx.coin()
      setShopPerks(rollPerkChoices(perks, 3))
      showMsg('새로운 암시장 전리품 목록이 도착했습니다.')
    }
  }

  const activeBuffCount = Object.values(activeBuffs).filter(Boolean).length

  return (
    <div className="screen store-screen">
      <div className="store-meta">
        <p className="eyebrow">ROUND {round} · DUST TOWN GENERAL STORE</p>
        <div className="store-header-box">
          <div className="store-title-group">
            <h2 className="store-title">더스트 타운 잡화점 & 살룬</h2>
            <p className="store-sub">
              "피를 흘리기 싫다면 장비에 돈을 아끼지 마시오."
            </p>
          </div>
          <div className="store-wallet">
            <span className="wallet-label">보유 현상금</span>
            <strong className="wallet-amount">${bounty.toLocaleString()}</strong>
          </div>
        </div>
      </div>

      {storeMessage && <div className="store-toast">{storeMessage}</div>}

      <div className="store-sections">
        {/* 1. 결투 / 대치 1회성 보급품 */}
        <section className="store-section">
          <div className="section-title-row">
            <h3>1회성 결투 보급품 (다음 라운드 적용)</h3>
            <span className="section-badge">활성 보급: {activeBuffCount}개</span>
          </div>
          <div className="store-grid consumables-grid">
            {CONSUMABLE_ITEMS.map((item) => {
              const active = !!activeBuffs[item.id]
              const affordable = bounty >= item.price
              return (
                <div
                  key={item.id}
                  className={`store-item-card${active ? ' owned' : ''}${!affordable && !active ? ' locked' : ''}`}
                >
                  <div className="item-card-top">
                    <span className="item-icon" aria-hidden>{item.icon}</span>
                    <span className={`item-tag tag-${item.tag}`}>{item.tag}</span>
                  </div>
                  <strong className="item-name">{item.name}</strong>
                  <p className="item-desc">{item.desc}</p>
                  <div className="item-card-bottom">
                    <span className="item-price">${item.price.toLocaleString()}</span>
                    <button
                      type="button"
                      className={`btn item-buy-btn${active ? ' active' : ''}`}
                      disabled={active}
                      onClick={() => handleBuyConsumable(item.id, item.price)}
                    >
                      {active ? '✓ 장착 중' : '구매'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* 2. 전리품 상점 */}
        <section className="store-section">
          <div className="section-title-row">
            <h3>암시장 특수 전리품 (지속 패시브)</h3>
            <button
              type="button"
              className="btn btn-reroll"
              onClick={handleRerollPerks}
            >
              🎲 목록 새로고침 (${PERK_REROLL_PRICE})
            </button>
          </div>
          <div className="store-grid perks-grid">
            {shopPerks.map((id) => {
              const perk = perkById(id)
              const owned = perks.includes(id)
              const affordable = bounty >= PERK_BUY_PRICE
              return (
                <div
                  key={id}
                  className={`store-item-card perk-shop-card${owned ? ' owned' : ''}${!affordable && !owned ? ' locked' : ''}`}
                >
                  <div className="item-card-top">
                    <PerkIcon id={id} />
                    <span className="item-tag tag-패시브">패시브</span>
                  </div>
                  <strong className="item-name">{perk.name}</strong>
                  <p className="item-desc">{perk.desc}</p>
                  <div className="item-card-bottom">
                    <span className="item-price">${PERK_BUY_PRICE.toLocaleString()}</span>
                    <button
                      type="button"
                      className={`btn item-buy-btn${owned ? ' active' : ''}`}
                      disabled={owned}
                      onClick={() => handleBuyPerk(id)}
                    >
                      {owned ? '✓ 보유 중' : '구매'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </div>

      <div className="store-actions">
        <button
          type="button"
          className="btn primary pulse store-next-btn"
          onClick={() => {
            sfx.click()
            sfx.gunLoad(0.7)
            onNext()
          }}
        >
          거리로 나서기 (다음 결투) ➔
        </button>
      </div>
    </div>
  )
}
