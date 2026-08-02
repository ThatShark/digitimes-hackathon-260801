import { useState } from 'react'
import { Link } from 'react-router-dom'
import './Watchlist.css'

const ALL_COINS = [
  { symbol: 'BTC', change: 2.3 },
  { symbol: 'ETH', change: -1.2 },
  { symbol: 'SOL', change: 5.7 },
  { symbol: 'DOGE', change: 0.4 },
  { symbol: 'ADA', change: -0.8 },
  { symbol: 'DOT', change: 3.1 },
  { symbol: 'PEPE', change: 15.2 },
  { symbol: 'WIF', change: 8.9 },
  { symbol: 'ARB', change: 4.2 },
  { symbol: 'LINK', change: -2.1 },
  { symbol: 'AVAX', change: 1.8 },
]

/**
 * 自選清單（Watchlist）
 * 用戶可新增/移除幣種
 */
export default function Watchlist() {
  const [watched, setWatched] = useState(() => {
    try {
      const stored = localStorage.getItem('watchlist_coins')
      if (stored) return JSON.parse(stored)
    } catch { /* ignore */ }
    return ['BTC', 'ETH', 'SOL', 'DOGE', 'ADA']
  })
  const [showAdd, setShowAdd] = useState(false)

  // 持久化到 localStorage，供 CommunityPage 讀取
  const updateWatched = (updater) => {
    setWatched((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      localStorage.setItem('watchlist_coins', JSON.stringify(next))
      return next
    })
  }

  const handleRemove = (symbol) => {
    updateWatched((prev) => prev.filter((s) => s !== symbol))
  }

  const handleAdd = (symbol) => {
    if (!watched.includes(symbol)) {
      updateWatched((prev) => [...prev, symbol])
    }
    setShowAdd(false)
  }

  const available = ALL_COINS.filter((c) => !watched.includes(c.symbol))

  return (
    <div className="watchlist">
      <div className="watchlist-header">
        <span className="watchlist-title">⭐ 我的自選</span>
        <button className="watchlist-add-btn" onClick={() => setShowAdd(!showAdd)}>
          + 新增
        </button>
      </div>

      <div className="watchlist-items">
        {watched.map((symbol) => {
          const coin = ALL_COINS.find((c) => c.symbol === symbol)
          const isUp = coin && coin.change >= 0
          return (
            <Link key={symbol} to={`/coin/${symbol}`} className="watchlist-chip">
              {symbol}
              {coin && (
                <span className={`chip-change ${isUp ? 'up' : 'down'}`}>
                  {isUp ? '+' : ''}{coin.change}%
                </span>
              )}
              <span
                className="watchlist-remove"
                onClick={(e) => { e.preventDefault(); handleRemove(symbol) }}
                title="移除"
              >
                ✕
              </span>
            </Link>
          )
        })}
      </div>

      {showAdd && available.length > 0 && (
        <div className="watchlist-add-dropdown">
          {available.map((coin) => (
            <button
              key={coin.symbol}
              className="watchlist-option"
              onClick={() => handleAdd(coin.symbol)}
            >
              {coin.symbol}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
