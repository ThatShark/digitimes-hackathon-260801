import './PortfolioOverview.css'

// Mock 持倉數據
const HOLDINGS = [
  { coin: 'BTC', quantity: 0.015, avgPrice: 2800000, currentPrice: 2850000 },
  { coin: 'ETH', quantity: 0.5, avgPrice: 95000, currentPrice: 98500 },
  { coin: 'SOL', quantity: 12, avgPrice: 5000, currentPrice: 5420 },
  { coin: 'DOGE', quantity: 3000, avgPrice: 8.0, currentPrice: 8.2 },
]

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b']

/**
 * 資產總覽區塊（長方形橫向佈局）
 */
export default function PortfolioOverview() {
  const portfolioItems = HOLDINGS.map((h) => ({
    ...h,
    value: h.quantity * h.currentPrice,
    cost: h.quantity * h.avgPrice,
    pnl: ((h.currentPrice - h.avgPrice) / h.avgPrice) * 100,
  }))

  const totalValue = portfolioItems.reduce((sum, item) => sum + item.value, 0)
  const totalCost = portfolioItems.reduce((sum, item) => sum + item.cost, 0)
  const totalPnlPct = ((totalValue - totalCost) / totalCost) * 100
  const isPositive = totalPnlPct >= 0

  return (
    <section className="portfolio-overview">
      <h2 className="portfolio-title">資產總覽</h2>

      {/* 總資產 + 損益 */}
      <div className="portfolio-summary">
        <div className="portfolio-stat">
          <span className="portfolio-stat-label">總資產價值</span>
          <span className="portfolio-stat-value">
            NT$ {totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>
        <div className="portfolio-stat">
          <span className="portfolio-stat-label">未實現損益</span>
          <span className={`portfolio-stat-value ${isPositive ? 'up' : 'down'}`}>
            {isPositive ? '+' : ''}{totalPnlPct.toFixed(2)}%
          </span>
        </div>
        <div className="portfolio-stat">
          <span className="portfolio-stat-label">持有幣種</span>
          <span className="portfolio-stat-value">{portfolioItems.length}</span>
        </div>
      </div>

      {/* 分配比例長條圖 */}
      <div className="allocation-bar">
        {portfolioItems.map((item, i) => (
          <div
            key={item.coin}
            className="allocation-segment"
            style={{
              width: `${(item.value / totalValue) * 100}%`,
              background: COLORS[i],
            }}
            title={`${item.coin}: ${((item.value / totalValue) * 100).toFixed(1)}%`}
          />
        ))}
      </div>

      {/* 幣種圖例 */}
      <div className="allocation-legend">
        {portfolioItems.map((item, i) => (
          <span key={item.coin} className="legend-chip">
            <span className="legend-dot" style={{ background: COLORS[i] }} />
            {item.coin} {((item.value / totalValue) * 100).toFixed(1)}%
          </span>
        ))}
      </div>

      {/* 逐幣明細 */}
      <div className="holdings-grid">
        {portfolioItems.map((item, i) => (
          <div key={item.coin} className="holding-card">
            <div className="holding-card-header">
              <span className="holding-dot" style={{ background: COLORS[i] }} />
              <span className="holding-name">{item.coin}</span>
              <span className={`holding-pnl ${item.pnl >= 0 ? 'up' : 'down'}`}>
                {item.pnl >= 0 ? '+' : ''}{item.pnl.toFixed(2)}%
              </span>
            </div>
            <div className="holding-card-body">
              <div className="holding-detail">
                <span className="holding-detail-label">持有量</span>
                <span className="holding-detail-value">{item.quantity}</span>
              </div>
              <div className="holding-detail">
                <span className="holding-detail-label">現值</span>
                <span className="holding-detail-value">
                  NT$ {item.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
