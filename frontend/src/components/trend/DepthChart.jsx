import { useState, useMemo } from 'react'
import { formatPrice, currencyLabel } from '../../utils/currency'
import './DepthChart.css'

const BASE_PRICES = {
  BTC: 2850000, ETH: 98500, SOL: 5420,
  DOGE: 8.2, ADA: 21.5, DOT: 245,
}

function generateOrderBook(basePrice, levels = 20) {
  const bids = []
  const asks = []
  let bidCum = 0
  let askCum = 0
  for (let i = 0; i < levels; i++) {
    const bidPrice = basePrice - (i + 1) * (basePrice * 0.0015)
    const askPrice = basePrice + (i + 1) * (basePrice * 0.0015)
    const bidVol = Math.round((Math.random() * 3 + 0.5 + i * 0.3) * 1000) / 1000
    const askVol = Math.round((Math.random() * 3 + 0.5 + i * 0.2) * 1000) / 1000
    bidCum += bidVol
    askCum += askVol
    bids.push({ price: Math.round(bidPrice), volume: bidVol, cumulative: bidCum })
    asks.push({ price: Math.round(askPrice), volume: askVol, cumulative: askCum })
  }
  return { bids, asks }
}

export default function DepthChart({ symbol, currency = 'TWD' }) {
  const basePrice = BASE_PRICES[symbol] || 1000
  const [hoverInfo, setHoverInfo] = useState(null)
  const { bids, asks } = useMemo(() => generateOrderBook(basePrice), [basePrice])

  const maxCum = Math.max(
    bids[bids.length - 1]?.cumulative || 0,
    asks[asks.length - 1]?.cumulative || 0
  )
  const totalBid = bids[bids.length - 1]?.cumulative || 0
  const totalAsk = asks[asks.length - 1]?.cumulative || 0
  const bidRatio = Math.round((totalBid / (totalBid + totalAsk)) * 100)

  const W = 300, H = 120, midIndex = bids.length

  const bidPath = useMemo(() => {
    const rev = [...bids].reverse()
    let d = `M 0 ${H}`
    rev.forEach((o, i) => {
      const x = (i / midIndex) * (W / 2)
      const y = H - (o.cumulative / maxCum) * H
      d += ` L ${x} ${y}`
    })
    return d + ` L ${W / 2} ${H} Z`
  }, [bids, midIndex, maxCum])

  const askPath = useMemo(() => {
    let d = `M ${W / 2} ${H}`
    asks.forEach((o, i) => {
      const x = W / 2 + ((i + 1) / asks.length) * (W / 2)
      const y = H - (o.cumulative / maxCum) * H
      d += ` L ${x} ${y}`
    })
    return d + ` L ${W} ${H} Z`
  }, [asks, maxCum])

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const ratio = x / rect.width
    if (ratio < 0.5) {
      const idx = Math.floor((1 - ratio * 2) * bids.length)
      const o = bids[Math.min(idx, bids.length - 1)]
      if (o) setHoverInfo({ side: 'bid', price: o.price, cumulative: o.cumulative, x: e.clientX - rect.left, y: e.clientY - rect.top })
    } else {
      const idx = Math.floor((ratio - 0.5) * 2 * asks.length)
      const o = asks[Math.min(idx, asks.length - 1)]
      if (o) setHoverInfo({ side: 'ask', price: o.price, cumulative: o.cumulative, x: e.clientX - rect.left, y: e.clientY - rect.top })
    }
  }

  // Y 軸刻度
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((pct) => ({
    label: (maxCum * pct).toFixed(2),
    y: H - pct * H,
  }))

  return (
    <div className="depth-chart">
      <div className="depth-header">
        <span className="depth-title">深度圖</span>
        <span className="depth-current-price">{formatPrice(basePrice, currency)}</span>
      </div>

      {/* 圖表區域（含 Y 軸） */}
      <div className="depth-chart-wrapper">
        {/* Y 軸 */}
        <div className="depth-y-axis">
          {yTicks.map((t, i) => (
            <span key={i} className="y-tick" style={{ bottom: `${(1 - t.y / H) * 100}%` }}>
              {t.label}
            </span>
          ))}
          <span className="y-axis-title">累積量</span>
        </div>

        {/* SVG */}
        <div
          className="depth-svg-container"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverInfo(null)}
        >
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="depth-svg">
            <path d={bidPath} className="depth-area-bid" />
            <path d={askPath} className="depth-area-ask" />
            <line x1={W / 2} y1={0} x2={W / 2} y2={H} className="depth-midline" />
          </svg>
          {hoverInfo && (
            <div className="depth-tooltip" style={{ left: Math.min(hoverInfo.x, 180), top: Math.max(hoverInfo.y - 40, 0) }}>
              <span className={`tooltip-side ${hoverInfo.side}`}>{hoverInfo.side === 'bid' ? '買盤' : '賣盤'}</span>
              <span className="tooltip-price">{formatPrice(hoverInfo.price, currency)}</span>
              <span className="tooltip-vol">累積量: {hoverInfo.cumulative.toFixed(4)}</span>
            </div>
          )}
        </div>
      </div>

      {/* X 軸 */}
      <div className="depth-x-axis">
        <span className="depth-x-label bid">{bids[bids.length - 1] && formatPrice(bids[bids.length - 1].price, currency)}</span>
        <span className="depth-x-label center">現價 ({currencyLabel(currency)})</span>
        <span className="depth-x-label ask">{asks[asks.length - 1] && formatPrice(asks[asks.length - 1].price, currency)}</span>
      </div>

      {/* Bid/Ask Ratio */}
      <div className="depth-ratio">
        <div className="depth-ratio-bar">
          <div className="ratio-bid" style={{ width: `${bidRatio}%` }} />
          <div className="ratio-ask" style={{ width: `${100 - bidRatio}%` }} />
        </div>
        <div className="depth-ratio-labels">
          <span className="ratio-label bid">買盤 {bidRatio}%</span>
          <span className="ratio-label ask">賣盤 {100 - bidRatio}%</span>
        </div>
      </div>

      {/* 訂單表 Order Book */}
      <div className="order-book">
        <div className="order-book-side">
          <div className="ob-header bid">買單 (Bid)</div>
          <div className="ob-col-headers">
            <span>價格 ({currencyLabel(currency)})</span><span>數量</span><span>累積</span>
          </div>
          {bids.slice(0, 8).map((o, i) => (
            <div key={i} className="ob-row bid">
              <span className="ob-price">{formatPrice(o.price, currency)}</span>
              <span className="ob-vol">{o.volume.toFixed(4)}</span>
              <span className="ob-cum">{o.cumulative.toFixed(4)}</span>
              <div className="ob-bar" style={{ width: `${(o.cumulative / maxCum) * 100}%` }} />
            </div>
          ))}
        </div>
        <div className="order-book-side">
          <div className="ob-header ask">賣單 (Ask)</div>
          <div className="ob-col-headers">
            <span>價格 ({currencyLabel(currency)})</span><span>數量</span><span>累積</span>
          </div>
          {asks.slice(0, 8).map((o, i) => (
            <div key={i} className="ob-row ask">
              <span className="ob-price">{formatPrice(o.price, currency)}</span>
              <span className="ob-vol">{o.volume.toFixed(4)}</span>
              <span className="ob-cum">{o.cumulative.toFixed(4)}</span>
              <div className="ob-bar" style={{ width: `${(o.cumulative / maxCum) * 100}%` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
