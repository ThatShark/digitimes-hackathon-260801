import { useState } from 'react'
import { useBalance } from './useBalance'
import { getAiStrategyParams } from '../../../services/coinApi'

export default function MartingaleForm({ symbol, currency }) {
  const [form, setForm] = useState({
    baseOrder: '',
    priceDrop: '2',
    volumeMultiplier: '1.5',
    maxSafetyOrders: '5',
    takeProfit: '3',
    triggerPrice: '',
    maxStopLoss: '',
  })
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const { balance, loading: balanceLoading } = useBalance()

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const handleAiFill = async () => {
    setAiLoading(true)
    try {
      const res = await getAiStrategyParams('martingale', symbol)
      if (res.params) {
        setForm((f) => ({
          ...f,
          baseOrder: String(res.params.baseOrder ?? f.baseOrder),
          priceDrop: String(res.params.priceDrop ?? f.priceDrop),
          volumeMultiplier: String(res.params.volumeMultiplier ?? f.volumeMultiplier),
          maxSafetyOrders: String(res.params.maxSafetyOrders ?? f.maxSafetyOrders),
          takeProfit: String(res.params.takeProfit ?? f.takeProfit),
        }))
      }
    } catch (err) {
      console.error('AI fill failed:', err)
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div className="strategy-form">
      <h4 className="sf-title">🎯 馬丁格爾 — {symbol}</h4>
      <p className="sf-desc">分批加倉策略，越跌買越多，只要價格小幅反彈即可整體獲利出場。</p>

      {/* 可用餘額 */}
      <div className="sf-balance">
        可用餘額：<span className="sf-balance-value">
          {balanceLoading ? '讀取中...' : balance !== null ? `${balance.toLocaleString()}` : '--'}
        </span> {currency}
      </div>

      {/* 主要參數 */}
      <div className="sf-group">
        <label className="sf-label">首單金額（{currency}）</label>
        <input
          type="text"
          inputMode="decimal"
          className="sf-input"
          placeholder="Base Order Amount"
          value={form.baseOrder}
          onChange={(e) => update('baseOrder', e.target.value)}
        />
      </div>

      <div className="sf-group">
        <label className="sf-label">加倉跌幅（%）</label>
        <input
          type="number"
          className="sf-input"
          step="0.5"
          min="0.5"
          max="20"
          placeholder="每下跌 X% 加倉一次"
          value={form.priceDrop}
          onChange={(e) => update('priceDrop', e.target.value)}
        />
      </div>

      <div className="sf-group">
        <label className="sf-label">加倉倍數</label>
        <input
          type="number"
          className="sf-input"
          step="0.1"
          min="1"
          max="5"
          placeholder="如 1.5 倍、2 倍"
          value={form.volumeMultiplier}
          onChange={(e) => update('volumeMultiplier', e.target.value)}
        />
      </div>

      <div className="sf-group">
        <label className="sf-label">最大加倉次數</label>
        <input
          type="number"
          className="sf-input"
          min="1"
          max="20"
          value={form.maxSafetyOrders}
          onChange={(e) => update('maxSafetyOrders', e.target.value)}
        />
      </div>

      <div className="sf-group">
        <label className="sf-label">目標止盈率（%）</label>
        <input
          type="number"
          className="sf-input"
          step="0.5"
          min="0.5"
          max="50"
          placeholder="相較平均成本獲利 X% 時全數賣出"
          value={form.takeProfit}
          onChange={(e) => update('takeProfit', e.target.value)}
        />
      </div>

      {/* 進階設定 */}
      <button
        type="button"
        className="sf-toggle-advanced"
        onClick={() => setShowAdvanced(!showAdvanced)}
      >
        {showAdvanced ? '▾ 收起進階設定' : '▸ 進階設定'}
      </button>

      {showAdvanced && (
        <div className="sf-advanced">
          <div className="sf-group">
            <label className="sf-label">開倉觸發價（{currency}）</label>
            <input
              type="text"
              inputMode="decimal"
              className="sf-input"
              placeholder="Start Trigger Price"
              value={form.triggerPrice}
              onChange={(e) => update('triggerPrice', e.target.value)}
            />
          </div>
          <div className="sf-group">
            <label className="sf-label">最大止損比例（%）</label>
            <input
              type="number"
              className="sf-input"
              step="1"
              min="1"
              max="100"
              placeholder="Max Stop Loss %"
              value={form.maxStopLoss}
              onChange={(e) => update('maxStopLoss', e.target.value)}
            />
          </div>
        </div>
      )}

      {/* 預覽區 */}
      <div className="sf-preview">
        <div className="sf-preview-title">策略預覽</div>
        <div className="sf-preview-row">
          <span>首單金額</span>
          <span>{form.baseOrder || '--'} {currency}</span>
        </div>
        <div className="sf-preview-row">
          <span>最大投入預估</span>
          <span>
            {form.baseOrder && form.volumeMultiplier && form.maxSafetyOrders
              ? (() => {
                  let total = Number(form.baseOrder)
                  let orderSize = Number(form.baseOrder)
                  for (let i = 0; i < Number(form.maxSafetyOrders); i++) {
                    orderSize *= Number(form.volumeMultiplier)
                    total += orderSize
                  }
                  return total.toFixed(0)
                })()
              : '--'}{' '}
            {currency}
          </span>
        </div>
        <div className="sf-preview-row">
          <span>止盈目標</span>
          <span>{form.takeProfit || '--'}%</span>
        </div>
      </div>

      {/* 操作按鈕 */}
      <div className="sf-actions">
        <button
          type="button"
          className="sf-btn sf-btn-secondary"
          onClick={handleAiFill}
          disabled={aiLoading}
        >
          {aiLoading ? '⏳ AI 分析中...' : '🤖 AI 填入'}
        </button>
        <button type="button" className="sf-btn sf-btn-primary">
          創建馬丁格爾策略
        </button>
      </div>
    </div>
  )
}
