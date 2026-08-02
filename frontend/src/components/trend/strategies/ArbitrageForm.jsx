import { useState } from 'react'
import { useBalance } from './useBalance'
import { getAiStrategyParams } from '../../../services/coinApi'

export default function ArbitrageForm({ symbol, currency }) {
  const [form, setForm] = useState({
    totalCapital: '',
    leverage: 1,
    autoCloseGuard: true,
    spreadLimit: '0.5',
  })
  const [aiLoading, setAiLoading] = useState(false)
  const { balance, loading: balanceLoading } = useBalance()

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const handleAiFill = async () => {
    setAiLoading(true)
    try {
      const res = await getAiStrategyParams('arbitrage', symbol)
      if (res.params) {
        setForm((f) => ({
          ...f,
          totalCapital: String(res.params.totalCapital ?? f.totalCapital),
          leverage: res.params.leverage ?? f.leverage,
          spreadLimit: String(res.params.spreadLimit ?? f.spreadLimit),
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
      <h4 className="sf-title">🔄 期現套利 — {symbol}</h4>
      <p className="sf-desc">
        買入現貨的同時做空同等價值的永續合約，對沖價格波動風險，穩賺資金費率。
      </p>

      {/* 可用餘額 */}
      <div className="sf-balance">
        可用餘額：<span className="sf-balance-value">
          {balanceLoading ? '讀取中...' : balance !== null ? `${balance.toLocaleString()}` : '--'}
        </span> {currency}
      </div>

      {/* 套利對象 */}
      <div className="sf-group">
        <label className="sf-label">套利對象</label>
        <div className="sf-info-box">
          {symbol}/{currency} — 當前資金費率：<span className="sf-highlight">+0.015%</span>/8h
        </div>
      </div>

      {/* 合約槓桿 */}
      <div className="sf-group">
        <label className="sf-label">合約槓桿倍數：{form.leverage}x</label>
        <input
          type="range"
          className="sf-slider"
          min="1"
          max="3"
          step="1"
          value={form.leverage}
          onChange={(e) => update('leverage', Number(e.target.value))}
        />
        <div className="sf-slider-labels">
          <span>1x</span>
          <span>2x</span>
          <span>3x</span>
        </div>
      </div>

      {/* 總套利金額 */}
      <div className="sf-group">
        <label className="sf-label">總套利金額（{currency}）</label>
        <input
          type="text"
          inputMode="decimal"
          className="sf-input"
          placeholder="系統自動 50% 買現貨、50% 開空單"
          value={form.totalCapital}
          onChange={(e) => update('totalCapital', e.target.value)}
        />
      </div>

      {/* 進階設定 */}
      <div className="sf-group">
        <label className="sf-checkbox">
          <input
            type="checkbox"
            checked={form.autoCloseGuard}
            onChange={(e) => update('autoCloseGuard', e.target.checked)}
          />
          資金費率倒置保護（費率轉負值時自動平倉）
        </label>
      </div>

      <div className="sf-group">
        <label className="sf-label">最大允許價差（%）</label>
        <input
          type="number"
          className="sf-input"
          step="0.1"
          min="0.1"
          max="5"
          placeholder="Spread Slippage Limit"
          value={form.spreadLimit}
          onChange={(e) => update('spreadLimit', e.target.value)}
        />
      </div>

      {/* 預覽區 */}
      <div className="sf-preview">
        <div className="sf-preview-title">策略預覽</div>
        <div className="sf-preview-row">
          <span>現貨買入</span>
          <span>{form.totalCapital ? (Number(form.totalCapital) / 2).toFixed(0) : '--'} {currency}</span>
        </div>
        <div className="sf-preview-row">
          <span>合約做空</span>
          <span>{form.totalCapital ? (Number(form.totalCapital) / 2).toFixed(0) : '--'} {currency}</span>
        </div>
        <div className="sf-preview-row">
          <span>槓桿</span>
          <span>{form.leverage}x</span>
        </div>
        <div className="sf-preview-row">
          <span>預估日收益（資金費率）</span>
          <span className="sf-highlight">
            {form.totalCapital
              ? ((Number(form.totalCapital) / 2) * 0.00015 * 3).toFixed(2)
              : '--'}{' '}
            {currency}/日
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
          ⚡ 一鍵套利
        </button>
      </div>
    </div>
  )
}
