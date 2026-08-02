import { useState } from 'react'
import { formatPrice } from '../../utils/currency'
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

const AI_TEMPLATES = [
  {
    id: 1, type: 'grid', label: '短期波動型',
    duration: '7~20 天', apy: '85.4%', coin: 'BTC',
    rangeLow: 2700000, rangeHigh: 3000000, grids: 50,
  },
  {
    id: 2, type: 'grid', label: '中期震盪型',
    duration: '1~2 個月', apy: '42.1%', coin: 'ETH',
    rangeLow: 90000, rangeHigh: 110000, grids: 30,
  },
  {
    id: 3, type: 'grid', label: '長期穩健型',
    duration: '3~6 個月', apy: '18.5%', coin: 'BTC',
    rangeLow: 2400000, rangeHigh: 3200000, grids: 80,
  },
]

const LIVE_PROFITS_TWD = [
  { user: '趙柏翰', strategy: '現貨網格', profitTWD: 1280, time: '2 分鐘前' },
  { user: '王大壯', strategy: 'DCA 定投', profitTWD: 680, time: '5 分鐘前' },
  { user: '陳Ｊ哥', strategy: '馬丁格爾', profitTWD: 3420, time: '8 分鐘前' },
]

export default function StrategyHub({ symbol, currency = 'TWD' }) {
  const [activeStrategy, setActiveStrategy] = useState(null)

  const handleStrategyClick = (key) => {
    setActiveStrategy(activeStrategy === key ? null : key)
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
            onClick={() => setActiveStrategy(null)}
            aria-label="關閉"
          >
            ✕
          </button>
          <ActiveForm symbol={symbol} currency={currency} />
        </section>
      )}

      {/* AI 模板推薦 */}
      <section className="hub-section">
        <h3 className="hub-section-title">
          🤖 AI 網格推薦 — {symbol}
        </h3>
        <div className="ai-templates">
          {AI_TEMPLATES.map((t) => (
            <div key={t.id} className="ai-template-card">
              <div className="template-header">
                <span className="template-label">{t.label}</span>
                <span className="template-duration">{t.duration}</span>
              </div>
              <div className="template-stats">
                <div className="template-stat">
                  <span className="ts-label">年化收益</span>
                  <span className="ts-value up">{t.apy}</span>
                </div>
                <div className="template-stat">
                  <span className="ts-label">區間</span>
                  <span className="ts-value">{formatPrice(t.rangeLow, currency)} - {formatPrice(t.rangeHigh, currency)}</span>
                </div>
                <div className="template-stat">
                  <span className="ts-label">網格數</span>
                  <span className="ts-value">{t.grids} 格</span>
                </div>
              </div>
              <button className="template-use-btn">使用此模板</button>
            </div>
          ))}
        </div>
      </section>

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
