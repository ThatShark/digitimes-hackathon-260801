import { useState } from 'react'
import { useBalance } from './useBalance'
import { getAiStrategyParams } from '../../../services/coinApi'

export default function SpotGridForm({ symbol, currency }) {
  const [form, setForm] = useState({
    lowerPrice: '',
    upperPrice: '',
    gridCount: '20',
    investment: '',
    gridMode: 'arithmetic',
    triggerPrice: '',
    takeProfit: '',
    stopLoss: '',
    closeOnStop: false,
  })
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const { balance, loading: balanceLoading } = useBalance()

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const handleAiFill = async () => {
    setAiLoading(true)
    try {
      const res = await getAiStrategyParams('grid', symbol)
      if (res.params) {
        setForm((f) => ({
          ...f,
          lowerPrice: String(res.params.lowerPrice ?? f.lowerPrice),
          upperPrice: String(res.params.upperPrice ?? f.upperPrice),
          gridCount: String(res.params.gridCount ?? f.gridCount),
          investment: String(res.params.investment ?? f.investment),
          gridMode: res.params.gridMode ?? f.gridMode,
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
      <h4 className="sf-title">📊 現貨網格 — {symbol}</h4>
      <p className="sf-desc">在設定的價格區間內分段掛單，低買高賣賺取價差。</p>

      {/* 可用餘額 */}
      <div className="sf-balance">
        可用餘額：<span className="sf-balance-value">
          {balanceLoading ? '讀取中...' : balance !== null ? `${balance.toLocaleString()}` : '--'}
        </span> {currency}
      </div>

      {/* 主要參數 */}
      <div className="sf-group">
        <label className="sf-label">區間最低價（{currency}）</label>
        <input
          type="text"
          inputMode="decimal"
          className="sf-input"
          placeholder="Lower Price"
          value={form.lowerPrice}
          onChange={(e) => update('lowerPrice', e.target.value)}
        />
      </div>

      <div className="sf-group">
        <label className="sf-label">區間最高價（{currency}）</label>
        <input
          type="text"
          inputMode="decimal"
          className="sf-input"
          placeholder="Upper Price"
          value={form.upperPrice}
          onChange={(e) => update('upperPrice', e.target.value)}
        />
      </div>

      <div className="sf-group">
        <label className="sf-label">網格數量（2～150）</label>
        <input
          type="number"
          className="sf-input"
          min="2"
          max="150"
          value={form.gridCount}
          onChange={(e) => update('gridCount', e.target.value)}
        />
      </div>

      <div className="sf-group">
        <label className="sf-label">投入金額（{currency}）</label>
        <input
          type="text"
          inputMode="decimal"
          className="sf-input"
          placeholder="Investment Amount"
          value={form.investment}
          onChange={(e) => update('investment', e.target.value)}
        />
      </div>

      {/* 網格模式 */}
      <div className="sf-group">
        <label className="sf-label">網格模式</label>
        <div className="sf-radio-row">
          <label className="sf-radio">
            <input
              type="radio"
              name="gridMode"
              value="arithmetic"
              checked={form.gridMode === 'arithmetic'}
              onChange={(e) => update('gridMode', e.target.value)}
            />
            等差網格
          </label>
          <label className="sf-radio">
            <input
              type="radio"
              name="gridMode"
              value="geometric"
              checked={form.gridMode === 'geometric'}
              onChange={(e) => update('gridMode', e.target.value)}
            />
            等比網格
          </label>
        </div>
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
            <label className="sf-label">觸發價格（{currency}）</label>
            <input
              type="text"
              inputMode="decimal"
              className="sf-input"
              placeholder="到達此價位才啟動網格"
              value={form.triggerPrice}
              onChange={(e) => update('triggerPrice', e.target.value)}
            />
          </div>
          <div className="sf-group">
            <label className="sf-label">止盈價格（{currency}）</label>
            <input
              type="text"
              inputMode="decimal"
              className="sf-input"
              placeholder="Take Profit"
              value={form.takeProfit}
              onChange={(e) => update('takeProfit', e.target.value)}
            />
          </div>
          <div className="sf-group">
            <label className="sf-label">止損價格（{currency}）</label>
            <input
              type="text"
              inputMode="decimal"
              className="sf-input"
              placeholder="Stop Loss"
              value={form.stopLoss}
              onChange={(e) => update('stopLoss', e.target.value)}
            />
          </div>
          <label className="sf-checkbox">
            <input
              type="checkbox"
              checked={form.closeOnStop}
              onChange={(e) => update('closeOnStop', e.target.checked)}
            />
            停機時賣出（終止策略時自動清空持股換回台幣）
          </label>
        </div>
      )}

      {/* 預覽區 */}
      <div className="sf-preview">
        <div className="sf-preview-title">策略預覽</div>
        <div className="sf-preview-row">
          <span>預計每格價差</span>
          <span>
            {form.lowerPrice && form.upperPrice && form.gridCount
              ? ((Number(form.upperPrice) - Number(form.lowerPrice)) / Number(form.gridCount)).toFixed(2)
              : '--'}
          </span>
        </div>
        <div className="sf-preview-row">
          <span>單格投入</span>
          <span>
            {form.investment && form.gridCount
              ? (Number(form.investment) / Number(form.gridCount)).toFixed(2)
              : '--'}{' '}
            {currency}
          </span>
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
          創建策略
        </button>
      </div>
    </div>
  )
}
