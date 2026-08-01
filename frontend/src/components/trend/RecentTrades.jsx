import { useState, useEffect } from 'react'
import { formatPrice, currencyLabel } from '../../utils/currency'
import './RecentTrades.css'

const BASE_PRICES = {
  BTC: 2850000,
  ETH: 98500,
  SOL: 5420,
  DOGE: 8.2,
  ADA: 21.5,
}

// 遞增計數器，確保即使同一毫秒內產生多筆交易，id 依然唯一（避免 React key 重複警告）
let tradeIdCounter = 0

function generateTrade(symbol) {
  const basePrice = BASE_PRICES[symbol] || 1000
  const isBuy = Math.random() > 0.5
  const priceOffset = basePrice * (Math.random() * 0.003 - 0.0015)
  const price = basePrice + priceOffset
  const volume = Math.round((Math.random() * 3 + 0.01) * 10000) / 10000
  const now = new Date()
  const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
  return {
    id: `trade-${Date.now()}-${++tradeIdCounter}`,
    side: isBuy ? 'buy' : 'sell',
    price: Math.round(price),
    volume,
    time,
  }
}

function generateInitialTrades(symbol, count = 12) {
  return Array.from({ length: count }, () => generateTrade(symbol))
}

/**
 * 最新成交明細
 * 即時模擬成交流水（每 2 秒新增一筆）
 */
export default function RecentTrades({ symbol, currency = 'TWD' }) {
  const [trades, setTrades] = useState(() => generateInitialTrades(symbol))

  useEffect(() => {
    const timer = setInterval(() => {
      setTrades((prev) => {
        const newTrade = generateTrade(symbol)
        return [newTrade, ...prev.slice(0, 19)]
      })
    }, 2000)
    return () => clearInterval(timer)
  }, [symbol])

  return (
    <div className="recent-trades">
      <div className="trades-header">
        <span className="trades-title">最新成交</span>
        <span className="trades-symbol">{symbol}/{currencyLabel(currency)}</span>
      </div>

      <div className="trades-table-header">
        <span>價格 ({currencyLabel(currency)})</span>
        <span>數量</span>
        <span>時間</span>
      </div>

      <div className="trades-list">
        {trades.map((trade) => (
          <div key={trade.id} className={`trade-row ${trade.side}`}>
            <span className="trade-price">
              {formatPrice(trade.price, currency)}
            </span>
            <span className="trade-volume">{trade.volume.toFixed(4)}</span>
            <span className="trade-time">{trade.time}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
