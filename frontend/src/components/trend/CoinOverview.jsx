import { formatPrice, formatLargePrice } from '../../utils/currency'
import './CoinOverview.css'

const COIN_DATA = {
  BTC: {
    name: 'Bitcoin', rank: 1, marketCapTWD: 56800000000000,
    circulatingSupply: '19,720,000 BTC', maxSupply: '21,000,000 BTC',
    circulationRate: 93.9, volume24hTWD: 1200000000000,
    ath: { priceTWD: 3280000, date: '2025/01/20' },
    atl: { priceTWD: 3215, date: '2013/07/05' },
    launchDate: '2009/01/03',
    about: 'Bitcoin 是第一個去中心化的加密貨幣，由中本聰（Satoshi Nakamoto）於 2008 年發表白皮書，2009 年正式上線。採用工作量證明（Proof of Work）共識機制，總供應量上限為 2,100 萬枚。',
    tags: ['No. 1', '主流幣', 'Layer 1', 'PoW'],
  },
  ETH: {
    name: 'Ethereum', rank: 2, marketCapTWD: 11800000000000,
    circulatingSupply: '120,200,000 ETH', maxSupply: '無上限',
    circulationRate: 100, volume24hTWD: 680000000000,
    ath: { priceTWD: 155000, date: '2024/12/16' },
    atl: { priceTWD: 28, date: '2015/10/20' },
    launchDate: '2015/07/30',
    about: 'Ethereum 是全球最大的智能合約平台，由 Vitalik Buterin 創立。2022 年成功轉型為權益證明（PoS），大幅降低能耗。支持 DeFi、NFT 及各種去中心化應用。',
    tags: ['No. 2', '主流幣', 'Layer 1', 'PoS', '智能合約'],
  },
  SOL: {
    name: 'Solana', rank: 5, marketCapTWD: 2600000000000,
    circulatingSupply: '440,000,000 SOL', maxSupply: '無上限',
    circulationRate: 75.8, volume24hTWD: 180000000000,
    ath: { priceTWD: 8200, date: '2025/01/19' },
    atl: { priceTWD: 28, date: '2022/12/29' },
    launchDate: '2020/03/16',
    about: 'Solana 是高性能公鏈，以極低手續費和每秒數千筆交易吞吐量著稱。採用歷史證明（Proof of History）+ PoS 混合共識，主打 DeFi 和 NFT 生態。',
    tags: ['Top 5', '高性能', 'Layer 1', 'PoH'],
  },
}

const DEFAULT_DATA = {
  name: 'Unknown', rank: '-', marketCapTWD: 0,
  circulatingSupply: '-', maxSupply: '-',
  circulationRate: 0, volume24hTWD: 0,
  ath: { priceTWD: 0, date: '-' },
  atl: { priceTWD: 0, date: '-' },
  launchDate: '-',
  about: '暫無資料',
  tags: [],
}

export default function CoinOverview({ symbol, currency = 'TWD' }) {
  const data = COIN_DATA[symbol] || DEFAULT_DATA

  return (
    <div className="coin-overview">
      {/* Tags */}
      <div className="overview-tags">
        {data.tags.map((tag) => (
          <span key={tag} className="overview-tag">{tag}</span>
        ))}
      </div>

      {/* Key metrics grid */}
      <div className="overview-metrics">
        <MetricCard label="市值排名" value={`#${data.rank}`} />
        <MetricCard label="總市值" value={formatLargePrice(data.marketCapTWD, currency)} />
        <MetricCard label="24H 成交額" value={formatLargePrice(data.volume24hTWD, currency)} />
        <MetricCard label="流通量" value={data.circulatingSupply} />
        <MetricCard label="最大供應" value={data.maxSupply} />
        <MetricCard label="流通率" value={`${data.circulationRate}%`} />
        <MetricCard label="發行日期" value={data.launchDate} />
        <MetricCard label="歷史最高 (ATH)" value={formatPrice(data.ath.priceTWD, currency)} sub={data.ath.date} highlight="up" />
        <MetricCard label="歷史最低 (ATL)" value={formatPrice(data.atl.priceTWD, currency)} sub={data.atl.date} highlight="down" />
      </div>

      {/* About section */}
      <div className="overview-about">
        <h3 className="about-title">關於 {data.name}</h3>
        <p className="about-text">{data.about}</p>
      </div>
    </div>
  )
}

function MetricCard({ label, value, sub, highlight }) {
  return (
    <div className="metric-card">
      <span className="metric-label">{label}</span>
      <span className={`metric-value ${highlight || ''}`}>{value}</span>
      {sub && <span className="metric-sub">{sub}</span>}
    </div>
  )
}
