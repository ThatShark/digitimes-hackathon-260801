import { useState } from 'react'
import { formatPrice } from '../../utils/currency'
import { isBackendConfigured } from '../../services/api'
import {
  SpotGridForm,
  DCAForm,
  MartingaleForm,
  ArbitrageForm,
  BasketForm,
  SignalForm,
} from './strategies'
import './StrategyHub.css'

const STRATEGY_TYPES = [
  { key: 'grid', icon: '📊', label: '現貨網格', desc: '自動高拋低吸' },
  { key: 'dca', icon: '📅', label: 'DCA 定投', desc: '自動平攤成本' },
  { key: 'martingale', icon: '🎯', label: '馬丁格爾', desc: '跌多買多反彈獲利' },
  { key: 'arbitrage', icon: '🔄', label: '期現套利', desc: '穩賺資金費率' },
  { key: 'basket', icon: '🧺', label: '幣幣組合', desc: '自動再平衡' },
  { key: 'signal', icon: '📡', label: '技術訊號', desc: '指標觸發下單' },
]

const STRATEGY_FORM_MAP = {
  grid: SpotGridForm,
  dca: DCAForm,
  martingale: MartingaleForm,
  arbitrage: ArbitrageForm,
  basket: BasketForm,
  signal: SignalForm,
}

const LIVE_PROFITS_TWD = [
  { user: '趙柏翰', strategy: '現貨網格', profitTWD: 1280, time: '2 分鐘前' },
  { user: '王大壯', strategy: 'DCA 定投', profitTWD: 680, time: '5 分鐘前' },
  { user: '陳Ｊ哥', strategy: '馬丁格爾', profitTWD: 3420, time: '8 分鐘前' },
]

export default function StrategyHub({ symbol, currency = 'TWD' }) {
  const [activeStrategy, setActiveStrategy] = useState(null)
  const [prefillParams, setPrefillParams] = useState(null)

  const handleStrategyClick = (key) => {
    setActiveStrategy(activeStrategy === key ? null : key)
    setPrefillParams(null)
  }

  const ActiveForm = activeStrategy ? STRATEGY_FORM_MAP[activeStrategy] : null

  return (
    <div className="strategy-hub">
      {/* 策略建立入口 */}
      <section className="hub-section">
        <h3 className="hub-section-title">建立策略</h3>
        <div className="strategy-type-grid">
          {STRATEGY_TYPES.map((s) => (
            <button
              key={s.key}
              className={`strategy-type-card${activeStrategy === s.key ? ' active' : ''}`}
              onClick={() => handleStrategyClick(s.key)}
            >
              <span className="stc-icon">{s.icon}</span>
              <span className="stc-label">{s.label}</span>
              <span className="stc-desc">{s.desc}</span>
            </button>
          ))}
        </div>
      </section>

      {/* 策略表單面板 */}
      {ActiveForm && (
        <section className="hub-section strategy-form-panel">
          <button
            className="sf-close-btn"
            onClick={() => { setActiveStrategy(null); setPrefillParams(null) }}
            aria-label="關閉"
          >
            ✕
          </button>
          <ActiveForm symbol={symbol} currency={currency} prefill={prefillParams} />
        </section>
      )}

      {/* 實盤賺取動態 */}
      <section className="hub-section">
        <h3 className="hub-section-title">💰 實盤賺取動態</h3>
        <div className="live-profits">
          {LIVE_PROFITS_TWD.map((p, i) => (
            <div key={i} className="profit-row">
              <span className="profit-user">{p.user}</span>
              <span className="profit-strategy">{p.strategy}</span>
              <span className="profit-amount">+{formatPrice(p.profitTWD, currency)}</span>
              <span className="profit-time">{p.time}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
