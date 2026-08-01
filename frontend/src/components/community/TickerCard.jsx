import { useState } from 'react'
import { Link } from 'react-router-dom'
import DepthChart from '../trend/DepthChart'
import './TickerCard.css'

// Mock 幣種即時數據
const TICKER_DATA = {
  BTC: { name: 'Bitcoin', price: 2850000, change: 2.3, high: 2920000, low: 2780000 },
  ETH: { name: 'Ethereum', price: 98500, change: -1.2, high: 101000, low: 96800 },
  SOL: { name: 'Solana', price: 5420, change: 5.7, high: 5580, low: 5100 },
  DOGE: { name: 'Dogecoin', price: 8.2, change: 0.4, high: 8.5, low: 7.9 },
  ADA: { name: 'Cardano', price: 21.5, change: -0.8, high: 22.1, low: 20.8 },
  DOT: { name: 'Polkadot', price: 245, change: 3.1, high: 252, low: 238 },
  PEPE: { name: 'Pepe', price: 0.032, change: 15.2, high: 0.035, low: 0.028 },
  WIF: { name: 'dogwifhat', price: 12.8, change: 8.9, high: 13.5, low: 11.2 },
  ARB: { name: 'Arbitrum', price: 38.5, change: 4.2, high: 39.8, low: 36.5 },
}

/**
 * $Ticker 動態互動卡片
 * 點擊展開：即時數據 + 深度圖分頁
 */
export default function TickerCard({ symbol }) {
  const [expanded, setExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState('price')
  const data = TICKER_DATA[symbol.toUpperCase()]

  if (!data) {
    return <span className="ticker-tag ticker-unknown">${symbol}</span>
  }

  const isUp = data.change >= 0

  return (
    <span
      className="ticker-card-wrapper"
      onClick={() => setExpanded(!expanded)}
    >
      <span className={`ticker-tag ${isUp ? 'up' : 'down'}`}>
        ${symbol.toUpperCase()}
        <span className="ticker-inline-price">
          {isUp ? '↑' : '↓'}{Math.abs(data.change)}%
        </span>
      </span>

      {expanded && (
        <div className="ticker-popup" onClick={(e) => e.stopPropagation()}>
          {/* Tab 切換 */}
          <div className="ticker-popup-tabs">
            <button
              className={`ticker-tab ${activeTab === 'price' ? 'active' : ''}`}
              onClick={() => setActiveTab('price')}
            >
              行情
            </button>
            <button
              className={`ticker-tab ${activeTab === 'depth' ? 'active' : ''}`}
              onClick={() => setActiveTab('depth')}
            >
              深度
            </button>
          </div>

          {/* 行情 tab */}
          {activeTab === 'price' && (
            <>
              <div className="ticker-popup-header">
                <span className="ticker-popup-name">{data.name}</span>
                <span className="ticker-popup-symbol">{symbol.toUpperCase()}</span>
              </div>
              <div className="ticker-popup-price">
                <span className="ticker-popup-current">
                  NT$ {data.price.toLocaleString()}
                </span>
                <span className={`ticker-popup-change ${isUp ? 'up' : 'down'}`}>
                  {isUp ? '+' : ''}{data.change}%
                </span>
              </div>
              <div className="ticker-popup-range">
                <div className="ticker-range-item">
                  <span className="range-label">24H 高</span>
                  <span className="range-value">NT$ {data.high.toLocaleString()}</span>
                </div>
                <div className="ticker-range-item">
                  <span className="range-label">24H 低</span>
                  <span className="range-value">NT$ {data.low.toLocaleString()}</span>
                </div>
              </div>
            </>
          )}

          {/* 深度圖 tab */}
          {activeTab === 'depth' && (
            <div className="ticker-depth-container">
              <DepthChart symbol={symbol.toUpperCase()} />
            </div>
          )}

          <Link
            to={`/coin/${symbol.toUpperCase()}`}
            className="ticker-popup-link"
          >
            查看直播 →
          </Link>
        </div>
      )}
    </span>
  )
}

/**
 * 解析文字中的 $TICKER 標記，轉為 TickerCard 元件
 */
export function parseTickerTags(text) {
  const parts = text.split(/(\$[A-Za-z]{2,10})/g)
  return parts.map((part, i) => {
    const match = part.match(/^\$([A-Za-z]{2,10})$/)
    if (match) {
      return <TickerCard key={i} symbol={match[1]} />
    }
    return <span key={i}>{part}</span>
  })
}
