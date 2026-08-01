import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import MarketOverview from '../components/main/MarketOverview'
import NotificationBanner from '../components/shared/NotificationBanner'
import BookmarkButton from '../components/shared/BookmarkButton'
import { fetchLivePriceInfo } from '../services/coinApi'
import { isBackendConfigured } from '../services/api'
import './MainPage.css'

// 平時關注 = 自己有持有的幣種
const MOCK_COINS = [
  { symbol: 'BTC', name: 'Bitcoin', price: null, change: null },
  { symbol: 'ETH', name: 'Ethereum', price: null, change: null },
  { symbol: 'SOL', name: 'Solana', price: null, change: null },
]

// 熱門 = 其他幣種
const TRENDING = [
  { symbol: 'DOGE', name: 'Dogecoin', price: null, change: null },
  { symbol: 'ADA', name: 'Cardano', price: null, change: null },
  { symbol: 'DOT', name: 'Polkadot', price: null, change: null },
]

// 後端請求失敗時的 fallback 假資料
const FALLBACK_PRICES = {
  BTC: { price: 2850000, change: 2.3 },
  ETH: { price: 98500, change: -1.2 },
  SOL: { price: 5420, change: 5.7 },
  DOGE: { price: 8.2, change: 0.4 },
  ADA: { price: 21.5, change: -0.8 },
  DOT: { price: 245, change: 3.1 },
}

const COIN_NAMES = {
  BTC: 'Bitcoin', ETH: 'Ethereum', SOL: 'Solana', DOGE: 'Dogecoin',
  ADA: 'Cardano', DOT: 'Polkadot',
}

/**
 * 幣種卡片需要 name 欄位，補在共用的 fetchLivePriceInfo 結果上。
 */
async function fetchLivePrice(symbol) {
  const live = await fetchLivePriceInfo(symbol)
  return live ? { ...live, name: COIN_NAMES[symbol] || symbol } : null
}

function CoinCard({ coin }) {
  const isLoading = coin.price === null || coin.price === undefined
  const isUp = coin.change >= 0

  return (
    <Link to={`/coin/${coin.symbol}`} className="coin-card">
      <div className="coin-card-header">
        <div className="coin-icon">{coin.symbol.charAt(0)}</div>
        {!isLoading && (
          <span className={`coin-badge ${isUp ? 'up' : 'down'}`}>
            {isUp ? '▲' : '▼'}
          </span>
        )}
      </div>
      <div className="coin-card-body">
        <div className="coin-name">{coin.name}</div>
        <div className="coin-symbol">{coin.symbol}</div>
        {isLoading ? (
          <div className="coin-price loading">載入中...</div>
        ) : (
          <div className={`coin-price ${isUp ? 'up' : 'down'}`}>
            NT$ {coin.price.toLocaleString()}
          </div>
        )}
        <div className="coin-card-bottom-row">
          {isLoading ? (
            <span className="coin-change loading">--</span>
          ) : (
            <span className={`coin-change ${isUp ? 'up' : 'down'}`}>
              {isUp ? '+' : ''}{coin.change}%
            </span>
          )}
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
    const allSymbols = [...MOCK_COINS, ...TRENDING].map((c) => c.symbol)
    const results = isBackendConfigured()
      ? await Promise.all(allSymbols.map(fetchLivePrice))
      : []

    const liveBySymbol = new Map()
    results.forEach((live) => {
      if (live) liveBySymbol.set(live.symbol, live)
    })

    // 套用即時價格；沒拿到即時價格的幣種 fallback 回假資料，
    // 這樣「載入中...」只會在真正還在等待時顯示，不會卡住。
    const applyResult = (coin) => {
      const live = liveBySymbol.get(coin.symbol)
      if (live) return live
      const fallback = FALLBACK_PRICES[coin.symbol]
      return fallback ? { ...coin, ...fallback } : coin
    }

    setFocusCoins((prev) => prev.map(applyResult))
    setTrendingCoins((prev) => prev.map(applyResult))
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
