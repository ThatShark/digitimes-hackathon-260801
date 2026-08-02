import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import MarketOverview from '../components/main/MarketOverview'
import NotificationBanner from '../components/shared/NotificationBanner'
import BookmarkButton from '../components/shared/BookmarkButton'
import { formatPrice } from '../utils/currency'
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

function sortCoins(coins, sortBy) {
  if (sortBy === 'default') return coins
  return [...coins].sort((a, b) => {
    if (sortBy === 'price') return (b.price || 0) - (a.price || 0)
    if (sortBy === 'change') return (b.change || 0) - (a.change || 0)
    if (sortBy === 'name') return a.name.localeCompare(b.name)
    return 0
  })
}

function CoinCard({ coin, currency }) {
  const isLoading = coin.price === null || coin.price === undefined
  const isUp = coin.change >= 0

  return (
    <Link to={`/coin/${coin.symbol}`} className="coin-card">
      <div className="coin-card-header">
        <span className="coin-card-name">{coin.name}</span>
        {!isLoading && (
          <span className={`coin-badge ${isUp ? 'up' : 'down'}`}>
            {isUp ? '▲' : '▼'}
          </span>
        )}
      </div>
      <div className="coin-card-body">
        <div className="coin-symbol">{coin.symbol}</div>
        {isLoading ? (
          <div className="coin-price loading">載入中...</div>
        ) : (
          <div className={`coin-price ${isUp ? 'up' : 'down'}`}>
            {formatPrice(coin.price, currency)}
          </div>
        )}
        <div className="coin-card-bottom-row">
          {isLoading ? (
            <span className="coin-change loading">--</span>
          ) : (
            <span className={`coin-change ${isUp ? 'up' : 'down'}`}>
              {isUp ? '+' : ''}{coin.change.toFixed(2)}%
            </span>
          )}
          <BookmarkButton symbol={coin.symbol} size="sm" />
        </div>
      </div>
    </Link>
  )
}

export default function MainPage() {
  const [focusCoins, setFocusCoins] = useState(MOCK_COINS)
  const [trendingCoins, setTrendingCoins] = useState(TRENDING)
  const [currency, setCurrency] = useState('TWD')
  const [sortBy, setSortBy] = useState('default') // 'default' | 'price' | 'change' | 'name'

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
      <MarketOverview currency={currency} coins={[...focusCoins, ...trendingCoins]} />

      <section className="coin-section">
        <div className="coin-section-header">
          <button
            className="currency-toggle"
            onClick={() => setCurrency((c) => c === 'TWD' ? 'USD' : 'TWD')}
          >
            {currency === 'TWD' ? '🇹🇼 TWD' : '🇺🇸 USD'}
          </button>
          <div className="sort-controls">
            {[
              { key: 'default', label: '預設' },
              { key: 'price', label: '價格' },
              { key: 'change', label: '漲幅' },
              { key: 'name', label: '名稱' },
            ].map((s) => (
              <button
                key={s.key}
                className={`sort-btn ${sortBy === s.key ? 'active' : ''}`}
                onClick={() => setSortBy(s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="coin-grid">
          {sortCoins([...focusCoins, ...trendingCoins], sortBy).map((coin) => (
            <CoinCard key={coin.symbol} coin={coin} currency={currency} />
          ))}
        </div>
      </section>
    </div>
  )
}
