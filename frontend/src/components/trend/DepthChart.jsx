import './DepthChart.css'

// Mock order book data
function generateOrders(basePrice, side) {
  const orders = []
  for (let i = 0; i < 8; i++) {
    const offset = (i + 1) * (basePrice * 0.002)
    const price = side === 'bid'
      ? basePrice - offset
      : basePrice + offset
    const volume = Math.round((Math.random() * 5 + 0.5) * 1000) / 1000
    orders.push({ price: Math.round(price), volume })
  }
  return orders
}

const BASE_PRICES = {
  BTC: 2850000,
  ETH: 98500,
  SOL: 5420,
  DOGE: 8.2,
  ADA: 21.5,
}

/**
 * 深度圖 (Order Book Depth)
 * 顯示買賣掛單分佈
 */
export default function DepthChart({ symbol }) {
  const basePrice = BASE_PRICES[symbol] || 1000
  const bids = generateOrders(basePrice, 'bid')
  const asks = generateOrders(basePrice, 'ask')

  const maxVolume = Math.max(
    ...bids.map((o) => o.volume),
    ...asks.map((o) => o.volume)
  )

  const spread = asks[0].price - bids[0].price
  const spreadPct = ((spread / basePrice) * 100).toFixed(3)

  return (
    <div className="depth-chart">
      <div className="depth-header">
        <span className="depth-title">深度圖</span>
        <span className="depth-spread">
          價差: NT$ {spread.toLocaleString()} ({spreadPct}%)
        </span>
      </div>

      {/* 視覺化長條圖 */}
      <div className="depth-visual">
        {[...bids].reverse().map((order, i) => (
          <div
            key={`bid-${i}`}
            className="depth-bar bid"
            style={{ height: `${(order.volume / maxVolume) * 100}%` }}
            title={`${order.price} / ${order.volume}`}
          />
        ))}
        {asks.map((order, i) => (
          <div
            key={`ask-${i}`}
            className="depth-bar ask"
            style={{ height: `${(order.volume / maxVolume) * 100}%` }}
            title={`${order.price} / ${order.volume}`}
          />
        ))}
      </div>

      <div className="depth-labels">
        <span className="depth-label bid">← 買單 (Bids)</span>
        <span className="depth-label ask">賣單 (Asks) →</span>
      </div>

      {/* 掛單明細 */}
      <div className="depth-orders">
        <div className="depth-side">
          <div className="depth-side-title bid">買單</div>
          {bids.slice(0, 5).map((order, i) => (
            <div key={i} className="depth-order-row">
              <span>NT$ {order.price.toLocaleString()}</span>
              <span>{order.volume.toFixed(4)}</span>
            </div>
          ))}
        </div>
        <div className="depth-side">
          <div className="depth-side-title ask">賣單</div>
          {asks.slice(0, 5).map((order, i) => (
            <div key={i} className="depth-order-row">
              <span>NT$ {order.price.toLocaleString()}</span>
              <span>{order.volume.toFixed(4)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
