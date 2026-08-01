import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import MarketOverview from '../components/main/MarketOverview'
import Watchlist from '../components/main/Watchlist'
import NotificationBanner from '../components/shared/NotificationBanner'
import BookmarkButton from '../components/shared/BookmarkButton'
import { getCoinPrice } from '../services/coinApi'
import { isBackendConfigured } from '../services/api'
import './MainPage.css'

const MOCK_COINS = [
  { symbol: 'BTC', name: 'Bitcoin', price: 2850000, change: 2.3 },
  { symbol: 'ETH', name: 'Ethereum', price: 98500, change: -1.2 },
  { symbol: 'SOL', name: 'Solana', price: 5420, change: 5.7 },
  { symbol: 'DOGE', name: 'Dogecoin', price: 8.2, change: 0.4 },
  { symbol: 'ADA', name: 'Cardano', price: 21.5, change: -0.8 },
  { symbol: 'DOT', name: 'Polkadot', price: 245, change: 3.1 },
]

const TRENDING = [
  { symbol: 'PEPE', name: 'Pepe', price: 0.032, change: 15.2 },
  { symbol: 'WIF', name: 'dogwifhat', price: 12.8, change: 8.9 },
  { symbol: 'ARB', name: 'Arbitrum', price: 38.5, change: 4.2 },
]

/**
 * 幣種對應的中文/展示名稱（後端只回傳 currency/last 等原始價格欄位，
 * 名稱維持前端自己管理，之後可以改成從 /recommend/coins 拿）
 */
const COIN_NAMES = {
  BTC: 'Bitcoin', ETH: 'Ethereum', SOL: 'Solana', DOGE: 'Dogecoin',
  ADA: 'Cardano', DOT: 'Polkadot', PEPE: 'Pepe', WIF: 'dogwifhat', ARB: 'Arbitrum',
}

/**
 * 嘗試向後端取得即時價格；若後端未設定或請求失敗，
 * 回傳 null 讓呼叫端 fallback 回 mock 資料。
 */
async function fetchLivePrice(symbol) {
  if (!isBackendConfigured()) return null
  try {
    const data = await getCoinPrice(symbol)
    const change = data.open ? ((data.last - data.open) / data.open) * 100 : 0
    return {
      symbol,
      name: COIN_NAMES[symbol] || symbol,
      price: data.last,
      change: Math.round(change * 10) / 10,
    }
  } catch {
    return null
  }
}

function CoinCard({ coin }) {
  const isUp = coin.change >= 0
  return (
    <Link to={`/coin/${coin.symbol}`} className="coin-card">
      <div className="coin-card-header">
        <div className="coin-icon">{coin.symbol.charAt(0)}</div>
        {coin.change !== undefined && (
          <span className={`coin-badge ${isUp ? 'up' : 'down'}`}>
            {isUp ? '▲' : '▼'}
          </span>
        )}
      </div>
      <div className="coin-card-body">
        <div className="coin-name">{coin.name}</div>
        <div className="coin-symbol">{coin.symbol}</div>
        <div className={`coin-price ${isUp ? 'up' : 'down'}`}>
          NT$ {coin.price.toLocaleString()}
        </div>
        <div className="coin-card-bottom-row">
          <span className={`coin-change ${isUp ? 'up' : 'down'}`}>
            {isUp ? '+' : ''}{coin.change}%
          </span>
          <BookmarkButton symbol={coin.symbol} size="sm" />
        </div>
      </div>
    </Link>
  )
}

export default function MainPage() {
  // 先用 mock 資料渲染，成功連到後端後再逐筆替換成即時價格。
  // 後端沒設定 (VITE_API_BASE_URL 未填) 或請求失敗時，畫面維持 mock 資料不受影響。
  const [focusCoins, setFocusCoins] = useState(MOCK_COINS)
  const [trendingCoins, setTrendingCoins] = useState(TRENDING)

  const refreshPrices = useCallback(async () => {
    if (!isBackendConfigured()) return

    const allSymbols = [...MOCK_COINS, ...TRENDING].map((c) => c.symbol)
    const results = await Promise.all(allSymbols.map(fetchLivePrice))

    const liveBySymbol = new Map()
    results.forEach((live) => {
      if (live) liveBySymbol.set(live.symbol, live)
    })
    if (liveBySymbol.size === 0) return // 全部失敗，維持 mock 資料

    setFocusCoins((prev) => prev.map((c) => liveBySymbol.get(c.symbol) || c))
    setTrendingCoins((prev) => prev.map((c) => liveBySymbol.get(c.symbol) || c))
  }, [])

  useEffect(() => {
    refreshPrices()
  }, [refreshPrices])

  return (
    <div className="main-page">
      {/* 通知條 */}
      <NotificationBanner />

      {/* 行情看板 */}
      <MarketOverview />

      {/* 自選清單 */}
      <Watchlist />

      <section className="coin-section">
        <h2 className="section-title">平時關注</h2>
        <div className="coin-grid">
          {focusCoins.map((coin) => (
            <CoinCard key={coin.symbol} coin={coin} />
          ))}
        </div>
      </section>

      <section className="coin-section">
        <h2 className="section-title">熱門</h2>
        <div className="coin-grid">
          {trendingCoins.map((coin) => (
            <CoinCard key={coin.symbol} coin={coin} />
          ))}
        </div>
      </section>
    </div>
  )
}
