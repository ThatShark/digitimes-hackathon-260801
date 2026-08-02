import './PortfolioOverview.css'

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4']

/**
 * 資產總覽區塊（長方形橫向佈局）
 *
 * 資料一律由 ProfilePage 透過 GET /portfolio 取得後往下傳，這裡不再持有
 * 自己的 mock 資料。載入中／後端未設定時 `portfolio` 傳 null，畫面顯示
 * 「讀取中」，跟幣價卡片的 loading 呈現方式一致。
 *
 * @param {object|null} portfolio - null 代表讀取中；否則為
 *   { total_value, total_pnl_pct, holdings: [{ currency, quantity, avg_cost,
 *   current_price, value, pnl_pct, allocation_pct }] }
 */
export default function PortfolioOverview({ portfolio }) {
  const isLoading = portfolio === null

  if (isLoading) {
    return (
      <section className="portfolio-overview">
        <h2 className="portfolio-title">資產總覽</h2>
        <div className="portfolio-summary">
          <div className="portfolio-stat">
            <span className="portfolio-stat-label">總資產價值</span>
            <span className="portfolio-stat-value loading">讀取中...</span>
          </div>
          <div className="portfolio-stat">
            <span className="portfolio-stat-label">未實現損益</span>
            <span className="portfolio-stat-value loading">讀取中...</span>
          </div>
          <div className="portfolio-stat">
            <span className="portfolio-stat-label">持有幣種</span>
            <span className="portfolio-stat-value loading">--</span>
          </div>
        </div>
      </section>
    )
  }

  const holdings = portfolio.holdings || []
  const twdBalance = portfolio.twd_balance ?? 0
  const coinValue = portfolio.total_value ?? 0
  const totalValue = coinValue + twdBalance
  const totalPnlPct = portfolio.total_pnl_pct ?? 0
  const isPositive = totalPnlPct >= 0

  // Build allocation data including TWD for the bar
  const allocationItems = []
  if (twdBalance > 0 && totalValue > 0) {
    allocationItems.push({
      currency: 'TWD',
      allocation_pct: (twdBalance / totalValue) * 100,
    })
  }
  holdings.forEach((item) => {
    const pct = totalValue > 0 ? (item.value / totalValue) * 100 : (item.allocation_pct ?? 0)
    allocationItems.push({ ...item, allocation_pct: pct })
  })

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
          <span className="portfolio-stat-value">{holdings.length}</span>
        </div>
      </div>

      {allocationItems.length === 0 ? (
        <p className="portfolio-empty">目前沒有持倉，快去交易頁面開始你的第一筆交易吧！</p>
      ) : (
        <>
          {/* 分配比例長條圖（含 TWD） */}
          <div className="allocation-bar">
            {allocationItems.map((item, i) => (
              <div
                key={item.currency}
                className="allocation-segment"
                style={{
                  width: `${item.allocation_pct}%`,
                  background: COLORS[i % COLORS.length],
                }}
                title={`${item.currency}: ${item.allocation_pct.toFixed(1)}%`}
              />
            ))}
          </div>

          {/* 幣種圖例（含 TWD） */}
          <div className="allocation-legend">
            {allocationItems.map((item, i) => (
              <span key={item.currency} className="legend-chip">
                <span className="legend-dot" style={{ background: COLORS[i % COLORS.length] }} />
                {item.currency} {item.allocation_pct.toFixed(1)}%
              </span>
            ))}
          </div>

          {/* 逐幣明細（不含 TWD） */}
          <div className="holdings-grid">
            {holdings.map((item, i) => (
              <div key={item.currency} className="holding-card">
                <div className="holding-card-header">
                  <span className="holding-dot" style={{ background: COLORS[(twdBalance > 0 ? i + 1 : i) % COLORS.length] }} />
                  <span className="holding-name">{item.currency}</span>
                  <span className={`holding-pnl ${item.pnl_pct >= 0 ? 'up' : 'down'}`}>
                    {item.pnl_pct >= 0 ? '+' : ''}{item.pnl_pct.toFixed(2)}%
                  </span>
                </div>
                <div className="holding-card-body">
                  <div className="holding-detail">
                    <span className="holding-detail-label">持有量</span>
                    <span className="holding-detail-value">
                      {item.quantity.toLocaleString(undefined, { maximumFractionDigits: 8 })}
                    </span>
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
        </>
      )}
    </section>
  )
}
