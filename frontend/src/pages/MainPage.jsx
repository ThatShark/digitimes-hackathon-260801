import { Link } from 'react-router-dom'
import MarketOverview from '../components/main/MarketOverview'
import Watchlist from '../components/main/Watchlist'
import NotificationBanner from '../components/shared/NotificationBanner'
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
        <div className={`coin-change ${isUp ? 'up' : 'down'}`}>
          {isUp ? '+' : ''}{coin.change}%
        </div>
      </div>
    </Link>
  )
}

export default function MainPage() {
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
          {MOCK_COINS.map((coin) => (
            <CoinCard key={coin.symbol} coin={coin} />
          ))}
        </div>
      </section>

      <section className="coin-section">
        <h2 className="section-title">熱門</h2>
        <div className="coin-grid">
          {TRENDING.map((coin) => (
            <CoinCard key={coin.symbol} coin={coin} />
          ))}
        </div>
      </section>
    </div>
  )
}
