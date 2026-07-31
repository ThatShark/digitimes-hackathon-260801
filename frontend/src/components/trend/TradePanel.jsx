import { useState } from 'react'
import './TradePanel.css'

const ORDER_TYPES = [
  { key: 'market', label: '市價' },
  { key: 'limit', label: '限價' },
  { key: 'tpsl', label: '止盈止損' },
]

export default function TradePanel({ symbol }) {
  const [action, setAction] = useState('buy')
  const [orderType, setOrderType] = useState('market')
  const [amount, setAmount] = useState('')
  const [limitPrice, setLimitPrice] = useState('')
  const [takeProfit, setTakeProfit] = useState('')
  const [stopLoss, setStopLoss] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  const handleConfirm = () => {
    setConfirmed(true)
    setTimeout(() => setConfirmed(false), 2000)
  }

  const canSubmit = amount && Number(amount) > 0

  return (
    <div className="trade-panel">
      <div className="trade-header">
        <span className="trade-title">交易</span>
      </div>
      <div className="trade-body">
        {/* 買/賣切換 */}
        <div className="trade-action-btns">
          <button
            className={`action-btn buy ${action === 'buy' ? 'active' : ''}`}
            onClick={() => setAction('buy')}
          >
            買入
          </button>
          <button
            className={`action-btn sell ${action === 'sell' ? 'active' : ''}`}
            onClick={() => setAction('sell')}
          >
            賣出
          </button>
        </div>

        {/* 訂單類型 tab */}
        <div className="order-type-tabs">
          {ORDER_TYPES.map((type) => (
            <button
              key={type.key}
              className={`order-type-tab ${orderType === type.key ? 'active' : ''}`}
              onClick={() => setOrderType(type.key)}
            >
              {type.label}
            </button>
          ))}
        </div>

        {/* 限價輸入 */}
        {orderType === 'limit' && (
          <div className="trade-input-group">
            <label className="trade-label">限價 (TWD)</label>
            <input
              type="number"
              className="trade-input"
              placeholder="設定目標價格"
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
            />
          </div>
        )}

        {/* 止盈止損輸入 */}
        {orderType === 'tpsl' && (
          <>
            <div className="trade-input-group">
              <label className="trade-label">止盈價格 (TWD)</label>
              <input
                type="number"
                className="trade-input tpsl-input tp"
                placeholder="達到此價格自動獲利了結"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
              />
            </div>
            <div className="trade-input-group">
              <label className="trade-label">止損價格 (TWD)</label>
              <input
                type="number"
                className="trade-input tpsl-input sl"
                placeholder="跌至此價格自動停損"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
              />
            </div>
          </>
        )}

        {/* 金額 */}
        <div className="trade-input-group">
          <label className="trade-label">金額 (TWD)</label>
          <input
            type="number"
            className="trade-input"
            placeholder="輸入金額"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        {/* 確認按鈕 */}
        <button
          className={`trade-confirm-btn ${action}`}
          onClick={handleConfirm}
          disabled={!canSubmit || confirmed}
        >
          {confirmed
            ? '✓ 已送出'
            : `確認${action === 'buy' ? '買入' : '賣出'} ${symbol}`
          }
        </button>

        {/* 訂單摘要 */}
        {orderType !== 'market' && (
          <div className="order-summary">
            <span className="order-summary-label">
              {orderType === 'limit' ? '限價單' : '止盈止損單'} ·{' '}
              {action === 'buy' ? '買入' : '賣出'} {symbol}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
