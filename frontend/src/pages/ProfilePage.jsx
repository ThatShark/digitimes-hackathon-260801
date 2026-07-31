import PersonalityBadge from '../components/shared/PersonalityBadge'
import './ProfilePage.css'

// Mock user data
const MOCK_USER = {
  displayName: '林睿瑜',
  bio: '目標在大學畢業前賺進人生第一桶金',
  personality: {
    code: 'ACSI',
    name: '弄潮兒',
    axes: { R: 68, E: 29, F: 82, S: 71 },
  },
  personalityDescription: '你是高頻交易的逆勢短線玩家，享受市場波動的藝術，以輕鬆寫意的心態在短線熱點中衝浪。',
  csvUploadedAt: '2025/07/28 14:30',
  stats: {
    totalTrades: 342,
    winRate: 58.2,
    avgHoldDays: 3.4,
    topCoins: ['BTC', 'ETH', 'SOL'],
  },
  watchedCoins: ['BTC', 'ETH', 'SOL', 'DOGE', 'ADA'],
}

const MOCK_HISTORY = [
  { id: 1, date: '2025/07/28', action: 'buy', currency: 'BTC', amount: 10000, price: 2850000, pnl: null },
  { id: 2, date: '2025/07/26', action: 'sell', currency: 'ETH', amount: 5000, price: 99200, pnl: +8.3 },
  { id: 3, date: '2025/07/24', action: 'buy', currency: 'SOL', amount: 3000, price: 5100, pnl: null },
  { id: 4, date: '2025/07/22', action: 'sell', currency: 'BTC', amount: 8000, price: 2920000, pnl: +2.5 },
  { id: 5, date: '2025/07/20', action: 'buy', currency: 'ETH', amount: 6000, price: 91500, pnl: null },
  { id: 6, date: '2025/07/18', action: 'sell', currency: 'DOGE', amount: 2000, price: 7.8, pnl: -4.1 },
  { id: 7, date: '2025/07/15', action: 'buy', currency: 'BTC', amount: 15000, price: 2780000, pnl: null },
  { id: 8, date: '2025/07/12', action: 'sell', currency: 'SOL', amount: 4000, price: 5380, pnl: +12.6 },
]

export default function ProfilePage() {
  const user = MOCK_USER

  return (
    <div className="profile-page">
      {/* Header section */}
      <section className="profile-header-section">
        <div className="profile-avatar-large">
          {user.displayName.charAt(0)}
        </div>
        <div className="profile-header-info">
          <h1 className="profile-display-name">{user.displayName}</h1>
          <PersonalityBadge personality={user.personality} compact showName />
          <p className="profile-bio">{user.bio}</p>
        </div>
      </section>

      <div className="profile-grid">
        {/* Personality axes */}
        <section className="profile-card personality-card">
          <h2 className="card-title">投資人格 4 軸</h2>
          <p className="personality-summary">
            <span className="personality-tag">{user.personality.code} {user.personality.name}</span>
            {' '}{user.personalityDescription}
          </p>
          <PersonalityBadge personality={user.personality} />
          <div className="csv-info">
            <span className="csv-label">CSV 上傳時間：{user.csvUploadedAt}</span>
            <div className="csv-actions">
              <button className="csv-btn">重新上傳</button>
              <button className="csv-btn primary">重新分析人格</button>
            </div>
          </div>
        </section>

        {/* Trade summary */}
        <section className="profile-card stats-card">
          <h2 className="card-title">交易摘要</h2>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-value">{user.stats.totalTrades}</span>
              <span className="stat-label">總交易次數</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{user.stats.winRate}%</span>
              <span className="stat-label">勝率</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{user.stats.avgHoldDays} 天</span>
              <span className="stat-label">平均持倉</span>
            </div>
          </div>
          <div className="top-coins">
            <span className="top-coins-label">最常交易</span>
            <div className="coin-tags">
              {user.stats.topCoins.map((c) => (
                <span key={c} className="coin-tag">{c}</span>
              ))}
            </div>
          </div>
        </section>

        {/* Watched coins */}
        <section className="profile-card watched-card">
          <h2 className="card-title">關注幣種</h2>
          <div className="watched-list">
            {user.watchedCoins.map((coin) => (
              <div key={coin} className="watched-item">
                <div className="watched-icon">{coin.charAt(0)}</div>
                <span className="watched-name">{coin}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Trade history */}
      <section className="profile-card history-card">
        <h2 className="card-title">交易歷史</h2>
        <div className="history-table-wrapper">
          <table className="history-table">
            <thead>
              <tr>
                <th>日期</th>
                <th>動作</th>
                <th>幣種</th>
                <th>金額 (TWD)</th>
                <th>價格</th>
                <th>損益</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_HISTORY.map((trade) => (
                <tr key={trade.id}>
                  <td>{trade.date}</td>
                  <td>
                    <span className={`trade-action-label ${trade.action}`}>
                      {trade.action === 'buy' ? '買入' : '賣出'}
                    </span>
                  </td>
                  <td className="trade-currency">{trade.currency}</td>
                  <td>NT$ {trade.amount.toLocaleString()}</td>
                  <td>NT$ {trade.price.toLocaleString()}</td>
                  <td className={trade.pnl === null ? '' : trade.pnl >= 0 ? 'pnl-positive' : 'pnl-negative'}>
                    {trade.pnl === null ? '—' : `${trade.pnl >= 0 ? '+' : ''}${trade.pnl}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
