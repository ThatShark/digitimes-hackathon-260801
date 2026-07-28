import { useState } from 'react'
import './TradePanel.css'

export default function TradePanel({ symbol }) {
  const [action, setAction] = useState('buy')
  const [amount, setAmount] = useState('')

  return (
    <div className="trade-panel">
      <div className="trade-header">
        <span className="trade-title">買賣</span>
      </div>
      <div className="trade-body">
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
        <button className={`trade-confirm-btn ${action}`}>
          確認{action === 'buy' ? '買入' : '賣出'} {symbol}
        </button>
      </div>
    </div>
  )
}
