import { useState } from 'react'
import { useBalance } from './useBalance'
import { getAiStrategyParams } from '../../../services/coinApi'

export default function SignalForm({ symbol, currency }) {
  const [form, setForm] = useState({
    indicatorType: 'rsi',
    timeframe: '1h',
    rsiPeriod: '14',
    rsiBuyBelow: '30',
    rsiSellAbove: '70',
    maFast: '7',
    maSlow: '25',
    webhookPassphrase: '',
    orderSize: '',
    takeProfit: '',
    stopLoss: '',
  })
  const [aiLoading, setAiLoading] = useState(false)
  const { balance, loading: balanceLoading } = useBalance()

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const webhookUrl = `https://api.example.com/webhook/${symbol}/signal`

  const handleAiFill = async () => {
    setAiLoading(true)
    try {
      const res = await getAiStrategyParams('signal', symbol)
      if (res.params) {
        setForm((f) => ({
          ...f,
          indicatorType: res.params.indicatorType ?? f.indicatorType,
          timeframe: res.params.timeframe ?? f.timeframe,
          rsiPeriod: String(res.params.rsiPeriod ?? f.rsiPeriod),
          rsiBuyBelow: String(res.params.rsiBuyBelow ?? f.rsiBuyBelow),
          rsiSellAbove: String(res.params.rsiSellAbove ?? f.rsiSellAbove),
          maFast: String(res.params.maFast ?? f.maFast),
          maSlow: String(res.params.maSlow ?? f.maSlow),
          orderSize: String(res.params.orderSize ?? f.orderSize),
          takeProfit: String(res.params.takeProfit ?? f.takeProfit),
          stopLoss: String(res.params.stopLoss ?? f.stopLoss),
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
      <h4 className="sf-title">📡 技術訊號 — {symbol}</h4>
      <p className="sf-desc">
        依據技術指標（RSI、MACD、均線）或外部 TradingView 訊號觸發自動買賣。
      </p>

      {/* 可用餘額 */}
      <div className="sf-balance">
        可用餘額：<span className="sf-balance-value">
          {balanceLoading ? '讀取中...' : balance !== null ? `${balance.toLocaleString()}` : '--'}
        </span> {currency}
      </div>

      {/* 指標選擇 */}
      <div className="sf-group">
        <label className="sf-label">指標類型</label>
        <select
          className="sf-select"
          value={form.indicatorType}
          onChange={(e) => update('indicatorType', e.target.value)}
        >
          <option value="rsi">RSI</option>
          <option value="macd">MACD</option>
          <option value="ma">MA 雙均線交叉</option>
          <option value="webhook">自訂 Webhook</option>
        </select>
      </div>

      <div className="sf-group">
        <label className="sf-label">K 線週期</label>
        <select
          className="sf-select"
          value={form.timeframe}
          onChange={(e) => update('timeframe', e.target.value)}
        >
          <option value="1m">1 分鐘</option>
          <option value="15m">15 分鐘</option>
          <option value="1h">1 小時</option>
          <option value="4h">4 小時</option>
          <option value="1D">1 天</option>
        </select>
      </div>

      {/* 動態參數 - RSI */}
      {form.indicatorType === 'rsi' && (
        <div className="sf-dynamic-params">
          <div className="sf-group">
            <label className="sf-label">RSI 週期</label>
            <input
              type="number"
              className="sf-input"
              min="2"
              max="100"
              value={form.rsiPeriod}
              onChange={(e) => update('rsiPeriod', e.target.value)}
            />
          </div>
          <div className="sf-group">
            <label className="sf-label">超賣買入值（RSI &lt;）</label>
            <input
              type="number"
              className="sf-input"
              min="1"
              max="50"
              value={form.rsiBuyBelow}
              onChange={(e) => update('rsiBuyBelow', e.target.value)}
            />
          </div>
          <div className="sf-group">
            <label className="sf-label">超買賣出值（RSI &gt;）</label>
            <input
              type="number"
              className="sf-input"
              min="50"
              max="99"
              value={form.rsiSellAbove}
              onChange={(e) => update('rsiSellAbove', e.target.value)}
            />
          </div>
        </div>
      )}

      {/* 動態參數 - MACD */}
      {form.indicatorType === 'macd' && (
        <div className="sf-dynamic-params">
          <div className="sf-info-box">
            MACD 使用預設參數（12, 26, 9），當 MACD 線穿越訊號線時觸發買賣。
          </div>
        </div>
      )}

      {/* 動態參數 - MA */}
      {form.indicatorType === 'ma' && (
        <div className="sf-dynamic-params">
          <div className="sf-group">
            <label className="sf-label">快線週期</label>
            <input
              type="number"
              className="sf-input"
              min="2"
              max="100"
              value={form.maFast}
              onChange={(e) => update('maFast', e.target.value)}
            />
          </div>
          <div className="sf-group">
            <label className="sf-label">慢線週期</label>
            <input
              type="number"
              className="sf-input"
              min="5"
              max="200"
              value={form.maSlow}
              onChange={(e) => update('maSlow', e.target.value)}
            />
          </div>
        </div>
      )}

      {/* 動態參數 - Webhook */}
      {form.indicatorType === 'webhook' && (
        <div className="sf-dynamic-params">
          <div className="sf-group">
            <label className="sf-label">Webhook URL</label>
            <div className="sf-webhook-url">
              <code className="sf-code">{webhookUrl}</code>
              <button
                type="button"
                className="sf-btn-icon"
                onClick={() => navigator.clipboard.writeText(webhookUrl)}
              >
                📋
              </button>
            </div>
          </div>
          <div className="sf-group">
            <label className="sf-label">Passphrase 金鑰</label>
            <input
              type="password"
              className="sf-input"
              placeholder="Passphrase"
              value={form.webhookPassphrase}
              onChange={(e) => update('webhookPassphrase', e.target.value)}
            />
          </div>
        </div>
      )}

      {/* 通用參數 */}
      <div className="sf-group">
        <label className="sf-label">單次觸發下單金額（{currency}）</label>
        <input
          type="text"
          inputMode="decimal"
          className="sf-input"
          placeholder="Order Size"
          value={form.orderSize}
          onChange={(e) => update('orderSize', e.target.value)}
        />
      </div>

      <div className="sf-row-2">
        <div className="sf-group">
          <label className="sf-label">止盈（%）</label>
          <input
            type="number"
            className="sf-input"
            min="0.5"
            max="100"
            step="0.5"
            placeholder="TP %"
            value={form.takeProfit}
            onChange={(e) => update('takeProfit', e.target.value)}
          />
        </div>
        <div className="sf-group">
          <label className="sf-label">止損（%）</label>
          <input
            type="number"
            className="sf-input"
            min="0.5"
            max="100"
            step="0.5"
            placeholder="SL %"
            value={form.stopLoss}
            onChange={(e) => update('stopLoss', e.target.value)}
          />
        </div>
      </div>

      {/* 預覽區 */}
      <div className="sf-preview">
        <div className="sf-preview-title">策略預覽</div>
        <div className="sf-preview-row">
          <span>指標</span>
          <span>
            {form.indicatorType === 'rsi' && `RSI(${form.rsiPeriod})`}
            {form.indicatorType === 'macd' && 'MACD(12,26,9)'}
            {form.indicatorType === 'ma' && `MA(${form.maFast}/${form.maSlow})`}
            {form.indicatorType === 'webhook' && 'Webhook'}
          </span>
        </div>
        <div className="sf-preview-row">
          <span>K 線週期</span>
          <span>{form.timeframe}</span>
        </div>
        <div className="sf-preview-row">
          <span>單次下單金額</span>
          <span>{form.orderSize || '--'} {currency}</span>
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
          綁定並開啟訊號策略
        </button>
      </div>
    </div>
  )
}
