import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import './WhaleAlertCard.css'

// Mock 巨鯨警報數據
const WHALE_ALERTS = [
  {
    id: 1,
    type: 'transfer',
    coin: 'BTC',
    amount: '500 BTC',
    from: 'Unknown Wallet',
    to: 'Binance',
    value: '14.2 億 TWD',
    time: '3 分鐘前',
  },
  {
    id: 2,
    type: 'buy',
    coin: 'ETH',
    amount: '12,000 ETH',
    from: '巨鯨地址 0x7a2...',
    to: null,
    value: '11.8 億 TWD',
    time: '12 分鐘前',
  },
  {
    id: 3,
    type: 'withdraw',
    coin: 'SOL',
    amount: '200,000 SOL',
    from: 'MAX Exchange',
    to: 'Cold Wallet',
    value: '10.8 億 TWD',
    time: '28 分鐘前',
  },
]

/**
 * 巨鯨警報卡片
 * 定時播報大額交易（mock 數據模擬）
 * 可用於社群 feed 或彈幕
 */
export default function WhaleAlertCard() {
  const [currentAlert, setCurrentAlert] = useState(0)

  // 每 8 秒切換一則警報
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentAlert((prev) => (prev + 1) % WHALE_ALERTS.length)
    }, 8000)
    return () => clearInterval(timer)
  }, [])

  const alert = WHALE_ALERTS[currentAlert]

  const typeIcon = alert.type === 'buy' ? '🟢'
    : alert.type === 'transfer' ? '🔄'
    : '🔴'

  const typeLabel = alert.type === 'buy' ? '大額買入'
    : alert.type === 'transfer' ? '大額轉帳'
    : '大額提出'

  return (
    <div className="whale-alert-card">
      <div className="whale-header">
        <span className="whale-icon">🐋</span>
        <span className="whale-title">巨鯨警報</span>
        <span className="whale-time">{alert.time}</span>
      </div>

      <div className="whale-body">
        <div className="whale-type-row">
          <span className="whale-type-icon">{typeIcon}</span>
          <span className="whale-type-label">{typeLabel}</span>
          <span className="whale-coin">{alert.coin}</span>
        </div>
        <div className="whale-amount">{alert.amount}</div>
        <div className="whale-value">≈ {alert.value}</div>
        <div className="whale-flow">
          <span className="whale-from">{alert.from}</span>
          <span className="whale-arrow">→</span>
          {alert.to && <span className="whale-to">{alert.to}</span>}
        </div>
      </div>

      <div className="whale-footer">
        <Link
          to={`/coin/${alert.coin}`}
          className="whale-action-btn"
        >
          查看 {alert.coin} 走勢 →
        </Link>
      </div>

      {/* 進度指示器 */}
      <div className="whale-indicators">
        {WHALE_ALERTS.map((_, i) => (
          <span
            key={i}
            className={`whale-dot ${i === currentAlert ? 'active' : ''}`}
          />
        ))}
      </div>
    </div>
  )
}
