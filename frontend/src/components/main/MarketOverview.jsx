import './MarketOverview.css'

// Mock 行情數據
const MARKET_STATS = {
  fearGreed: { value: 38, label: '恐慌' },
  btcDominance: 58.2,
  totalMarketCap: '3.12T',
  volume24h: '98.5B',
}

const TOP_GAINERS = [
  { symbol: 'PEPE', change: 15.2 },
  { symbol: 'WIF', change: 8.9 },
  { symbol: 'SOL', change: 5.7 },
]

const TOP_LOSERS = [
  { symbol: 'ETH', change: -1.2 },
  { symbol: 'ADA', change: -0.8 },
  { symbol: 'LINK', change: -2.1 },
]

/**
 * 行情看板 — 主頁頂部顯示市場概覽
 */
export default function MarketOverview() {
  const fg = MARKET_STATS.fearGreed
  const fgColor = fg.value <= 25 ? '#ef4444'
    : fg.value <= 45 ? '#f59e0b'
    : fg.value <= 55 ? '#94a3b8'
    : fg.value <= 75 ? '#10b981'
    : '#10b981'

  return (
    <div className="market-overview">
      {/* 概覽指標 */}
      <div className="market-stats-row">
        <div className="market-stat-item">
          <span className="stat-label-sm">恐懼貪婪指數</span>
          <span className="stat-value-sm" style={{ color: fgColor }}>
            {fg.value} — {fg.label}
          </span>
        </div>
        <div className="market-stat-item">
          <span className="stat-label-sm">BTC 佔比</span>
          <span className="stat-value-sm">{MARKET_STATS.btcDominance}%</span>
        </div>
        <div className="market-stat-item">
          <span className="stat-label-sm">全球市值</span>
          <span className="stat-value-sm">${MARKET_STATS.totalMarketCap}</span>
        </div>
        <div className="market-stat-item">
          <span className="stat-label-sm">24H 成交量</span>
          <span className="stat-value-sm">${MARKET_STATS.volume24h}</span>
        </div>
      </div>

      {/* 漲跌幅榜 */}
      <div className="market-movers">
        <div className="mover-section">
          <span className="mover-title">📈 漲幅榜</span>
          <div className="mover-list">
            {TOP_GAINERS.map((coin) => (
              <span key={coin.symbol} className="mover-chip up">
                {coin.symbol} +{coin.change}%
              </span>
            ))}
          </div>
        </div>
        <div className="mover-section">
          <span className="mover-title">📉 跌幅榜</span>
          <div className="mover-list">
            {TOP_LOSERS.map((coin) => (
              <span key={coin.symbol} className="mover-chip down">
                {coin.symbol} {coin.change}%
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
