import { useState, useEffect, useCallback } from 'react'
import { getMarketOverview } from '../../services/coinApi'
import { isBackendConfigured } from '../../services/api'
import './MarketOverview.css'

const FALLBACK_STATS = {
  fearGreed: { value: 38, label: '恐慌' },
  btcDominance: 58.247,
  totalMarketCapUSD: 3120000000000,
  volume24hUSD: 98500000000,
}

const FEAR_GREED_LABELS = {
  'Extreme Fear': '極度恐慌',
  Fear: '恐慌',
  Neutral: '中性',
  Greed: '貪婪',
  'Extreme Greed': '極度貪婪',
}

function formatLargeUSD(value) {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
  return `$${value.toLocaleString()}`
}

function formatLargeTWD(value) {
  const twd = value * 32.5
  if (twd >= 1e12) return `NT$${(twd / 1e12).toFixed(2)}T`
  if (twd >= 1e9) return `NT$${(twd / 1e9).toFixed(1)}B`
  return `NT$${twd.toLocaleString()}`
}

/**
 * 行情看板
 * @param {object} props
 * @param {'TWD'|'USD'} props.currency
 * @param {Array} props.coins - 幣種資料 [{symbol, change}]，用於漲跌幅榜
 */
export default function MarketOverview({ currency = 'TWD', coins = [] }) {
  const [stats, setStats] = useState(FALLBACK_STATS)

  const refresh = useCallback(async () => {
    if (!isBackendConfigured()) return
    try {
      const data = await getMarketOverview(3)
      if (data) {
        setStats({
          fearGreed: data.fear_greed
            ? { value: data.fear_greed.value, label: FEAR_GREED_LABELS[data.fear_greed.label] || data.fear_greed.label }
            : FALLBACK_STATS.fearGreed,
          btcDominance: data.btc_dominance ?? FALLBACK_STATS.btcDominance,
          totalMarketCapUSD: data.total_market_cap ?? FALLBACK_STATS.totalMarketCapUSD,
          volume24hUSD: data.volume_24h ?? FALLBACK_STATS.volume24hUSD,
        })
      }
    } catch { /* keep fallback */ }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const fg = stats.fearGreed
  const fgColor = fg.value <= 25 ? '#ef4444'
    : fg.value <= 45 ? '#f59e0b'
    : fg.value <= 55 ? '#94a3b8'
    : '#10b981'

  // 漲跌幅榜：從傳入的 coins 中取（已有 change 的）
  const validCoins = coins.filter((c) => c.change !== null && c.change !== undefined)
  const gainers = [...validCoins].filter((c) => c.change > 0).sort((a, b) => b.change - a.change)
  const losers = [...validCoins].filter((c) => c.change < 0).sort((a, b) => a.change - b.change)

  return (
    <div className="market-overview">
      <div className="market-stats-row">
        <div className="market-stat-item">
          <span className="stat-label-sm">恐懼貪婪指數</span>
          <span className="stat-value-sm" style={{ color: fgColor }}>
            {fg.value} — {fg.label}
          </span>
        </div>
        <div className="market-stat-item">
          <span className="stat-label-sm">BTC 佔比</span>
          <span className="stat-value-sm">{stats.btcDominance.toFixed(3)}%</span>
        </div>
        <div className="market-stat-item">
          <span className="stat-label-sm">全球市值</span>
          <span className="stat-value-sm">
            {currency === 'USD' ? formatLargeUSD(stats.totalMarketCapUSD) : formatLargeTWD(stats.totalMarketCapUSD)}
          </span>
        </div>
        <div className="market-stat-item">
          <span className="stat-label-sm">24H 成交量</span>
          <span className="stat-value-sm">
            {currency === 'USD' ? formatLargeUSD(stats.volume24hUSD) : formatLargeTWD(stats.volume24hUSD)}
          </span>
        </div>
      </div>

      <div className="market-movers">
        <div className="mover-section">
          <span className="mover-title">📈 漲幅榜</span>
          <div className="mover-list">
            {gainers.map((coin) => (
              <span key={coin.symbol} className="mover-chip up">
                {coin.symbol} +{coin.change}%
              </span>
            ))}
          </div>
        </div>
        <div className="mover-section">
          <span className="mover-title">📉 跌幅榜</span>
          <div className="mover-list">
            {losers.map((coin) => (
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
