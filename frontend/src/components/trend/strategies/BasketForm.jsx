import { useState } from 'react'
import { useBalance } from './useBalance'
import { getAiStrategyParams } from '../../../services/coinApi'
import { SUPPORTED_COINS } from './constants'
import ConfirmModal from './ConfirmModal'

export default function BasketForm({ symbol, currency }) {
  const [tokens, setTokens] = useState([
    { coin: symbol || 'BTC', weight: 50 },
    { coin: 'ETH', weight: 50 },
  ])
  const [form, setForm] = useState({
    totalInvestment: '',
    rebalanceMode: 'time',
    rebalancePeriod: 'weekly',
    deviationThreshold: '5',
  })
  const [aiLoading, setAiLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const { balance, loading: balanceLoading } = useBalance()

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const addToken = () => {
    // Find a coin not yet in the list
    const usedCoins = new Set(tokens.map((t) => t.coin))
    const available = SUPPORTED_COINS.find((c) => !usedCoins.has(c.symbol))
    setTokens([...tokens, { coin: available?.symbol || '', weight: 0 }])
  }

  const removeToken = (idx) => {
    setTokens(tokens.filter((_, i) => i !== idx))
  }

  const updateToken = (idx, field, value) => {
    setTokens(tokens.map((t, i) => (i === idx ? { ...t, [field]: value } : t)))
  }

  const totalWeight = tokens.reduce((sum, t) => sum + Number(t.weight || 0), 0)

  const handleAiFill = async () => {
    setAiLoading(true)
    try {
      const res = await getAiStrategyParams('basket', symbol)
      if (res.params) {
        if (Array.isArray(res.params.tokens)) {
          setTokens(res.params.tokens.map((t) => ({
            coin: t.coin || '',
            weight: Number(t.weight) || 0,
          })))
        }
        setForm((f) => ({
          ...f,
          totalInvestment: String(res.params.totalInvestment ?? f.totalInvestment),
          rebalanceMode: res.params.rebalanceMode ?? f.rebalanceMode,
          rebalancePeriod: res.params.rebalancePeriod ?? f.rebalancePeriod,
          deviationThreshold: String(res.params.deviationThreshold ?? f.deviationThreshold),
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
      <h4 className="sf-title">🧺 幣幣組合 / 自動再平衡</h4>
      <p className="sf-desc">
        建立多種加密貨幣投資組合，在比例偏離時自動買賣以恢復初始設定權重。
      </p>

      {/* 可用餘額 */}
      <div className="sf-balance">
        可用餘額：<span className="sf-balance-value">
          {balanceLoading ? '讀取中...' : balance !== null ? `${balance.toLocaleString()}` : '--'}
        </span> {currency}
      </div>

      {/* 組合配置 */}
      <div className="sf-group">
        <label className="sf-label">
          投資組合配置{' '}
          <span className={totalWeight === 100 ? 'sf-weight-ok' : 'sf-weight-err'}>
            （總權重：{totalWeight}%）
          </span>
        </label>
        <div className="sf-token-list">
          {tokens.map((t, i) => (
            <div key={i} className="sf-token-row">
              <select
                className="sf-select sf-select-sm"
                value={t.coin}
                onChange={(e) => updateToken(i, 'coin', e.target.value)}
              >
                <option value="">選擇幣種</option>
                {SUPPORTED_COINS.map((c) => (
                  <option key={c.symbol} value={c.symbol}>
                    {c.symbol} - {c.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                className="sf-input sf-input-sm"
                min="0"
                max="100"
                placeholder="%"
                value={t.weight}
                onChange={(e) => updateToken(i, 'weight', e.target.value)}
              />
              <span className="sf-token-pct">%</span>
              {tokens.length > 2 && (
                <button
                  type="button"
                  className="sf-btn-icon"
                  onClick={() => removeToken(i)}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        {tokens.length < SUPPORTED_COINS.length && (
          <button type="button" className="sf-btn-add" onClick={addToken}>
            + 新增幣種
          </button>
        )}
      </div>

      {/* 總投資金額 */}
      <div className="sf-group">
        <label className="sf-label">總投資金額（{currency}）</label>
        <input
          type="text"
          inputMode="decimal"
          className="sf-input"
          placeholder="Total Investment"
          value={form.totalInvestment}
          onChange={(e) => update('totalInvestment', e.target.value)}
        />
      </div>

      {/* 再平衡方式 */}
      <div className="sf-group">
        <label className="sf-label">再平衡觸發方式</label>
        <div className="sf-radio-row">
          <label className="sf-radio">
            <input
              type="radio"
              name="rebalanceMode"
              value="time"
              checked={form.rebalanceMode === 'time'}
              onChange={(e) => update('rebalanceMode', e.target.value)}
            />
            按時間再平衡
          </label>
          <label className="sf-radio">
            <input
              type="radio"
              name="rebalanceMode"
              value="deviation"
              checked={form.rebalanceMode === 'deviation'}
              onChange={(e) => update('rebalanceMode', e.target.value)}
            />
            按偏離比例再平衡
          </label>
        </div>
      </div>

      {form.rebalanceMode === 'time' && (
        <div className="sf-group">
          <label className="sf-label">再平衡週期</label>
          <select
            className="sf-select"
            value={form.rebalancePeriod}
            onChange={(e) => update('rebalancePeriod', e.target.value)}
          >
            <option value="daily">每天</option>
            <option value="weekly">每週</option>
            <option value="monthly">每月</option>
          </select>
        </div>
      )}

      {form.rebalanceMode === 'deviation' && (
        <div className="sf-group">
          <label className="sf-label">偏離門檻（%）</label>
          <input
            type="number"
            className="sf-input"
            min="1"
            max="30"
            placeholder="任一幣種偏離超過 X% 時觸發"
            value={form.deviationThreshold}
            onChange={(e) => update('deviationThreshold', e.target.value)}
          />
        </div>
      )}

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
        <button
          type="button"
          className="sf-btn sf-btn-primary"
          disabled={totalWeight !== 100}
          onClick={() => setShowConfirm(true)}
        >
          建立投資組合
        </button>
      </div>

      {/* 確認彈窗 */}
      <ConfirmModal
        open={showConfirm}
        title="確認建立投資組合"
        onCancel={() => setShowConfirm(false)}
        onConfirm={() => setShowConfirm(false)}
        confirmText="確認建立"
      >
        <div className="sf-preview">
          {tokens.map((t, i) => (
            <div key={i} className="sf-preview-row">
              <span>{t.coin || '未選'}</span>
              <span>
                {form.totalInvestment && t.weight
                  ? ((Number(form.totalInvestment) * Number(t.weight)) / 100).toFixed(0)
                  : '--'}{' '}
                {currency} ({t.weight}%)
              </span>
            </div>
          ))}
          <div className="sf-preview-row">
            <span>總投資金額</span>
            <span>{form.totalInvestment || '--'} {currency}</span>
          </div>
          <div className="sf-preview-row">
            <span>再平衡方式</span>
            <span>{form.rebalanceMode === 'time' ? `按時間（${form.rebalancePeriod}）` : `按偏離（${form.deviationThreshold}%）`}</span>
          </div>
        </div>
      </ConfirmModal>
    </div>
  )
}
