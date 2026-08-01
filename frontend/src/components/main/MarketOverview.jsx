import { useState, useEffect, useCallback } from 'react'
import { getMarketOverview } from '../../services/coinApi'
import { isBackendConfigured } from '../../services/api'
import './MarketOverview.css'

// 後端請求失敗時的 fallback 假資料（僅在即時資料拿不到時使用）
const FALLBACK_STATS = {
  fearGreed: { value: 38, label: '恐慌' },
  btcDominance: 58.2,
  totalMarketCap: '3.12T',
  volume24h: '98.5B',
}

const FALLBACK_GAINERS = [
  { symbol: 'PEPE', change: 15.2 },
  { symbol: 'WIF', change: 8.9 },
  { symbol: 'SOL', change: 5.7 },
]

const FALLBACK_LOSERS = [
  { symbol: 'ETH', change: -1.2 },
  { symbol: 'ADA', change: -0.8 },
  { symbol: 'LINK', change: -2.1 },
]

const FEAR_GREED_LABELS = {
  'Extreme Fear': '極度恐慌',
  Fear: '恐慌',
  Neutral: '中性',
  Greed: '貪婪',
  'Extreme Greed': '極度貪婪',
}

/** 數字轉成 "3.12T" / "98.5B" 這種簡寫字串 */
function formatLargeNumber(value) {
  if (value === null || value === undefined) return null
  const abs = Math.abs(value)
  if (abs >= 1e12) return `${(value / 1e12).toFixed(2)}T`
  if (abs >= 1e9) return `${(value / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1)}M`
  return value.toLocaleString()
}

/**
 * 向後端取得行情看板資料；後端未設定或請求失敗時回傳 null，
 * 讓呼叫端 fallback 回假資料，不會讓畫面掛掉。
 */
async function fetchLiveOverview() {
  if (!isBackendConfigured()) return null
  try {
    const data = await getMarketOverview(3)
    return {
      fearGreed: data.fear_greed
        ? {
            value: data.fear_greed.value,
            label: FEAR_GREED_LABELS[data.fear_greed.label] || data.fear_greed.label,
          }
        : null,
      btcDominance: data.btc_dominance,
      totalMarketCap: formatLargeNumber(data.total_market_cap),
      volume24h: formatLargeNumber(data.volume_24h),
      gainers: (data.top_gainers || []).map((c) => ({ symbol: c.symbol, change: c.change_24h })),
      losers: (data.top_losers || []).map((c) => ({ symbol: c.symbol, change: c.change_24h })),
    }
  } catch {
    return null
  }
}

/**
 * 行情看板 — 主頁頂部顯示市場概覽
 * 初始顯示「載入中」，向後端拿到資料後才顯示真實數字；
 * 最終失敗才 fallback 回假資料。
 */
export default function MarketOverview() {
  const [stats, setStats] = useState({ fearGreed: null, btcDominance: null, totalMarketCap: null, volume24h: null })
  const [gainers, setGainers] = useState(null)
  const [losers, setLosers] = useState(null)

  const refresh = useCallback(async () => {
    const live = await fetchLiveOverview()
    if (live) {
      setStats({
        fearGreed: live.fearGreed || FALLBACK_STATS.fearGreed,
        btcDominance: live.btcDominance ?? FALLBACK_STATS.btcDominance,
        totalMarketCap: live.totalMarketCap ?? FALLBACK_STATS.totalMarketCap,
        volume24h: live.volume24h ?? FALLBACK_STATS.volume24h,
      })
      setGainers(live.gainers.length > 0 ? live.gainers : FALLBACK_GAINERS)
      setLosers(live.losers.length > 0 ? live.losers : FALLBACK_LOSERS)
    } else {
      // 後端未設定或整組請求失敗 -> 全部 fallback 回假資料
      setStats(FALLBACK_STATS)
      setGainers(FALLBACK_GAINERS)
      setLosers(FALLBACK_LOSERS)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const isLoading = stats.fearGreed === null
  const fg = stats.fearGreed
  const fgColor = !fg ? '#94a3b8'
    : fg.value <= 25 ? '#ef4444'
    : fg.value <= 45 ? '#f59e0b'
    : fg.value <= 55 ? '#94a3b8'
    : '#10b981'

  return (
    <div className="market-overview">
      {/* 概覽指標 */}
      <div className="market-stats-row">
        <div className="market-stat-item">
          <span className="stat-label-sm">恐懼貪婪指數</span>
          {isLoading ? (
            <span className="stat-value-sm loading">載入中...</span>
          ) : (
            <span className="stat-value-sm" style={{ color: fgColor }}>
              {fg.value} — {fg.label}
            </span>
          )}
        </div>
        <div className="market-stat-item">
          <span className="stat-label-sm">BTC 佔比</span>
          {isLoading ? (
            <span className="stat-value-sm loading">載入中...</span>
          ) : (
            <span className="stat-value-sm">{stats.btcDominance}%</span>
          )}
        </div>
        <div className="market-stat-item">
          <span className="stat-label-sm">全球市值</span>
          {isLoading ? (
            <span className="stat-value-sm loading">載入中...</span>
          ) : (
            <span className="stat-value-sm">${stats.totalMarketCap}</span>
          )}
        </div>
        <div className="market-stat-item">
          <span className="stat-label-sm">24H 成交量</span>
          {isLoading ? (
            <span className="stat-value-sm loading">載入中...</span>
          ) : (
            <span className="stat-value-sm">${stats.volume24h}</span>
          )}
        </div>
      </div>

      {/* 漲跌幅榜 */}
      <div className="market-movers">
        <div className="mover-section">
          <span className="mover-title">📈 漲幅榜</span>
          <div className="mover-list">
            {gainers === null ? (
              <span className="mover-chip loading">載入中...</span>
            ) : (
              gainers.map((coin) => (
                <span key={coin.symbol} className="mover-chip up">
                  {coin.symbol} +{coin.change}%
                </span>
              ))
            )}
          </div>
        </div>
        <div className="mover-section">
          <span className="mover-title">📉 跌幅榜</span>
          <div className="mover-list">
            {losers === null ? (
              <span className="mover-chip loading">載入中...</span>
            ) : (
              losers.map((coin) => (
                <span key={coin.symbol} className="mover-chip down">
                  {coin.symbol} {coin.change}%
                </span>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
