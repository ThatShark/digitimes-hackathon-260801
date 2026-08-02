import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import MarketOverview from '../components/main/MarketOverview'
import NotificationBanner from '../components/shared/NotificationBanner'
import BookmarkButton from '../components/shared/BookmarkButton'
import { formatPrice } from '../utils/currency'
import { fetchLivePriceInfo } from '../services/coinApi'
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
  const hasError = coin.error
  const isUp = coin.change >= 0

  return (
    <Link to={`/coin/${coin.symbol}`} className="coin-card">
      <div className="coin-card-header">
        <span className="coin-card-name">{coin.name}</span>
        {!isLoading && !hasError && (
          <span className={`coin-badge ${isUp ? 'up' : 'down'}`}>
            {isUp ? '▲' : '▼'}
          </span>
        )}
      </div>
      <div className="coin-card-body">
        <div className="coin-symbol">{coin.symbol}</div>
        {hasError ? (
          <div className="coin-price error">⚠️ {coin.error}</div>
        ) : isLoading ? (
          <div className="coin-price loading">載入中...</div>
        ) : (
          <div className={`coin-price ${isUp ? 'up' : 'down'}`}>
            {formatPrice(coin.price, currency)}
          </div>
        )}
        <div className="coin-card-bottom-row">
          {hasError ? (
            <span className="coin-change error">--</span>
          ) : isLoading ? (
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

  const [error, setError] = useState(null)

  const refreshPrices = useCallback(async () => {
    const allSymbols = [...MOCK_COINS, ...TRENDING].map((c) => c.symbol)

    let results
    try {
      results = await Promise.all(
        allSymbols.map(async (symbol) => {
          try {
            const live = await fetchLivePrice(symbol)
            return live || { symbol, name: COIN_NAMES[symbol] || symbol, price: null, change: null, error: '無法取得報價' }
          } catch (err) {
            return { symbol, name: COIN_NAMES[symbol] || symbol, price: null, change: null, error: err.message || '請求失敗' }
          }
        })
      )
      setError(null)
    } catch (err) {
      setError(err.message || '無法連接後端服務')
      return
    }

    const applyResult = (coin) => {
      const result = results.find((r) => r.symbol === coin.symbol)
      return result || coin
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

      {error && (
        <div className="main-page-error">⚠️ {error}</div>
      )}

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
