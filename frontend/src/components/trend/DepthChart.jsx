import { useState, useMemo } from 'react'
import './DepthChart.css'

const BASE_PRICES = {
  BTC: 2850000,
  ETH: 98500,
  SOL: 5420,
  DOGE: 8.2,
  ADA: 21.5,
  DOT: 245,
}

// 生成累積掛單數據
function generateOrderBook(basePrice, levels = 20) {
  const bids = []
  const asks = []
  let bidCumulative = 0
  let askCumulative = 0

  for (let i = 0; i < levels; i++) {
    const bidPrice = basePrice - (i + 1) * (basePrice * 0.0015)
    const askPrice = basePrice + (i + 1) * (basePrice * 0.0015)
    const bidVol = Math.round((Math.random() * 3 + 0.5 + i * 0.3) * 1000) / 1000
    const askVol = Math.round((Math.random() * 3 + 0.5 + i * 0.2) * 1000) / 1000
    bidCumulative += bidVol
    askCumulative += askVol
    bids.push({ price: Math.round(bidPrice), volume: bidVol, cumulative: bidCumulative })
    asks.push({ price: Math.round(askPrice), volume: askVol, cumulative: askCumulative })
  }
  return { bids, asks }
}

/**
 * 深度圖 — 累積面積圖
 * X 軸：價格（中間為當前價）
 * Y 軸：累積掛單量
 * 綠色買盤（左）/ 紅色賣盤（右）
 */
export default function DepthChart({ symbol }) {
  const basePrice = BASE_PRICES[symbol] || 1000
  const [hoverInfo, setHoverInfo] = useState(null)

  const { bids, asks } = useMemo(() => generateOrderBook(basePrice), [basePrice])

  const maxCumulative = Math.max(
    bids[bids.length - 1]?.cumulative || 0,
    asks[asks.length - 1]?.cumulative || 0
  )

  const totalBidVol = bids[bids.length - 1]?.cumulative || 0
  const totalAskVol = asks[asks.length - 1]?.cumulative || 0
  const bidRatio = Math.round((totalBidVol / (totalBidVol + totalAskVol)) * 100)
  const askRatio = 100 - bidRatio

  // SVG path 生成
  const chartWidth = 300
  const chartHeight = 120
  const allPoints = [...[...bids].reverse(), ...asks]
  const totalLevels = allPoints.length
  const midIndex = bids.length

  const bidPath = useMemo(() => {
    const reversedBids = [...bids].reverse()
    let d = `M 0 ${chartHeight}`
    reversedBids.forEach((order, i) => {
      const x = (i / midIndex) * (chartWidth / 2)
      const y = chartHeight - (order.cumulative / maxCumulative) * chartHeight
      d += ` L ${x} ${y}`
    })
    d += ` L ${chartWidth / 2} ${chartHeight} Z`
    return d
  }, [bids, midIndex, maxCumulative, chartWidth, chartHeight])

  const askPath = useMemo(() => {
    let d = `M ${chartWidth / 2} ${chartHeight}`
    asks.forEach((order, i) => {
      const x = chartWidth / 2 + ((i + 1) / asks.length) * (chartWidth / 2)
      const y = chartHeight - (order.cumulative / maxCumulative) * chartHeight
      d += ` L ${x} ${y}`
    })
    d += ` L ${chartWidth} ${chartHeight} Z`
    return d
  }, [asks, maxCumulative, chartWidth, chartHeight])

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const ratio = x / rect.width

    if (ratio < 0.5) {
      const index = Math.floor((1 - ratio * 2) * bids.length)
      const order = bids[Math.min(index, bids.length - 1)]
      if (order) setHoverInfo({ side: 'bid', price: order.price, cumulative: order.cumulative, x: e.clientX - rect.left, y: e.clientY - rect.top })
    } else {
      const index = Math.floor((ratio - 0.5) * 2 * asks.length)
      const order = asks[Math.min(index, asks.length - 1)]
      if (order) setHoverInfo({ side: 'ask', price: order.price, cumulative: order.cumulative, x: e.clientX - rect.left, y: e.clientY - rect.top })
    }
  }

  return (
    <div className="depth-chart">
      <div className="depth-header">
        <span className="depth-title">深度圖</span>
        <span className="depth-current-price">
          NT$ {basePrice.toLocaleString()}
        </span>
      </div>

      {/* SVG 累積面積圖 */}
      <div
        className="depth-svg-container"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverInfo(null)}
      >
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" className="depth-svg">
          {/* 買盤綠色區域 */}
          <path d={bidPath} className="depth-area-bid" />
          {/* 賣盤紅色區域 */}
          <path d={askPath} className="depth-area-ask" />
          {/* 中線 */}
          <line x1={chartWidth / 2} y1={0} x2={chartWidth / 2} y2={chartHeight} className="depth-midline" />
        </svg>

        {/* Hover tooltip */}
        {hoverInfo && (
          <div
            className="depth-tooltip"
            style={{ left: Math.min(hoverInfo.x, chartWidth - 120), top: Math.max(hoverInfo.y - 40, 0) }}
          >
            <span className={`tooltip-side ${hoverInfo.side}`}>
              {hoverInfo.side === 'bid' ? '買盤' : '賣盤'}
            </span>
            <span className="tooltip-price">NT$ {hoverInfo.price.toLocaleString()}</span>
            <span className="tooltip-vol">累積量: {hoverInfo.cumulative.toFixed(4)}</span>
          </div>
        )}
      </div>

      {/* X 軸標籤 */}
      <div className="depth-x-labels">
        <span className="depth-x-label bid">
          {bids[bids.length - 1] && `NT$ ${bids[bids.length - 1].price.toLocaleString()}`}
        </span>
        <span className="depth-x-label center">現價</span>
        <span className="depth-x-label ask">
          {asks[asks.length - 1] && `NT$ ${asks[asks.length - 1].price.toLocaleString()}`}
        </span>
      </div>

      {/* Bid/Ask Ratio 進度條 */}
      <div className="depth-ratio">
        <div className="depth-ratio-bar">
          <div className="ratio-bid" style={{ width: `${bidRatio}%` }} />
          <div className="ratio-ask" style={{ width: `${askRatio}%` }} />
        </div>
        <div className="depth-ratio-labels">
          <span className="ratio-label bid">買盤 {bidRatio}%</span>
          <span className="ratio-label ask">賣盤 {askRatio}%</span>
        </div>
      </div>
    </div>
  )
}
