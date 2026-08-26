import { useState } from 'react'
import { sfx } from '../audio/sfx'
import { CONSUMABLE_ITEMS, PERK_BUY_PRICE, PERK_REROLL_PRICE } from '../data/shop'
import { rollPerkChoices } from '../data/perks'
import { localizedItem, localizedPerk } from '../i18n/content'
import { useT } from '../i18n/LocaleContext'
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
  const t = useT()
  const [shopPerks, setShopPerks] = useState<PerkId[]>(() => rollPerkChoices(perks, 3))
  const [storeMessage, setStoreMessage] = useState<string | null>(null)

  const showMsg = (msg: string) => {
    setStoreMessage(msg)
    setTimeout(() => setStoreMessage(null), 2500)
  }

  const handleBuyConsumable = (id: ConsumableId, price: number) => {
    if (activeBuffs[id]) {
      showMsg(t('store.haveItem'))
      return
    }
    if (bounty < price) {
      sfx.warn()
      showMsg(t('store.brokeHunt'))
      return
    }
    sfx.coin()
    onBuyConsumable(id, price)
    showMsg(t('store.bought'))
  }

  const handleBuyPerk = (id: PerkId) => {
    if (perks.includes(id)) {
      showMsg(t('store.havePerk'))
      return
    }
    if (bounty < PERK_BUY_PRICE) {
      sfx.warn()
      showMsg(t('store.broke'))
      return
    }
    sfx.coin()
    onBuyPerk(id, PERK_BUY_PRICE)
    setShopPerks((prev) => prev.filter((p) => p !== id))
    showMsg(t('store.gotPerk'))
  }

  const handleRerollPerks = () => {
    if (bounty < PERK_REROLL_PRICE) {
      sfx.warn()
      showMsg(t('store.rerollBroke'))
      return
    }
    if (onSpendBounty(PERK_REROLL_PRICE)) {
      sfx.coin()
      setShopPerks(rollPerkChoices(perks, 3))
      showMsg(t('store.rerolled'))
    }
  }

  const activeBuffCount = Object.values(activeBuffs).filter(Boolean).length

  return (
    <div className="screen store-screen">
      <div className="store-meta">
        <p className="eyebrow">ROUND {round} · DUST TOWN GENERAL STORE</p>
        <div className="store-header-box">
          <div className="store-title-group">
            <h2 className="store-title">{t('store.title')}</h2>
            <p className="store-sub">{t('store.quote')}</p>
          </div>
          <div className="store-wallet">
            <span className="wallet-label">{t('store.wallet')}</span>
            <strong className="wallet-amount">${bounty.toLocaleString()}</strong>
          </div>
        </div>
      </div>

      {storeMessage && <div className="store-toast">{storeMessage}</div>}

      <div className="store-sections">
        {/* 1. 결투 / 대치 1회성 보급품 */}
        <section className="store-section">
          <div className="section-title-row">
            <h3>{t('store.consumables')}</h3>
            <span className="section-badge">{t('store.active', { n: activeBuffCount })}</span>
          </div>
          <div className="store-grid consumables-grid">
            {CONSUMABLE_ITEMS.map((raw) => {
              const item = localizedItem(raw.id, t)
              const active = !!activeBuffs[item.id]
              const affordable = bounty >= item.price
              return (
                <div
                  key={item.id}
                  className={`store-item-card${active ? ' owned' : ''}${!affordable && !active ? ' locked' : ''}`}
                >
                  <div className="item-card-top">
                    <span className="item-icon" aria-hidden>{item.icon}</span>
                    <span className={`item-tag tag-${raw.tag}`}>{t(`tag.${raw.tag}`)}</span>
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
                      {active ? t('store.equipped') : t('store.buy')}
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
            <h3>{t('store.perks')}</h3>
            <button
              type="button"
              className="btn btn-reroll"
              onClick={handleRerollPerks}
            >
              🎲 {t('store.reroll', { n: PERK_REROLL_PRICE })}
            </button>
          </div>
          <div className="store-grid perks-grid">
            {shopPerks.map((id) => {
              const perk = localizedPerk(id, t)
              const owned = perks.includes(id)
              const affordable = bounty >= PERK_BUY_PRICE
              return (
                <div
                  key={id}
                  className={`store-item-card perk-shop-card${owned ? ' owned' : ''}${!affordable && !owned ? ' locked' : ''}`}
                >
                  <div className="item-card-top">
                    <PerkIcon id={id} />
                    <span className="item-tag tag-패시브">{t('store.passive')}</span>
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
                      {owned ? t('store.owned') : t('store.buy')}
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
          {t('store.next')}
        </button>
      </div>
    </div>
  )
}
