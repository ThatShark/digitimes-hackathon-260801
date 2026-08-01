import './CoinOverview.css'

const COIN_DATA = {
  BTC: {
    name: 'Bitcoin', rank: 1, marketCap: '56.8T TWD',
    circulatingSupply: '19,720,000 BTC', maxSupply: '21,000,000 BTC',
    circulationRate: 93.9, volume24h: '1.2T TWD',
    ath: { price: '3,280,000', date: '2025/01/20' },
    atl: { price: '3,215', date: '2013/07/05' },
    launchDate: '2009/01/03',
    about: 'Bitcoin 是第一個去中心化的加密貨幣，由中本聰（Satoshi Nakamoto）於 2008 年發表白皮書，2009 年正式上線。採用工作量證明（Proof of Work）共識機制，總供應量上限為 2,100 萬枚。',
    tags: ['No. 1', '主流幣', 'Layer 1', 'PoW'],
  },
  ETH: {
    name: 'Ethereum', rank: 2, marketCap: '11.8T TWD',
    circulatingSupply: '120,200,000 ETH', maxSupply: '無上限',
    circulationRate: 100, volume24h: '680B TWD',
    ath: { price: '155,000', date: '2024/12/16' },
    atl: { price: '28', date: '2015/10/20' },
    launchDate: '2015/07/30',
    about: 'Ethereum 是全球最大的智能合約平台，由 Vitalik Buterin 創立。2022 年成功轉型為權益證明（PoS），大幅降低能耗。支持 DeFi、NFT 及各種去中心化應用。',
    tags: ['No. 2', '主流幣', 'Layer 1', 'PoS', '智能合約'],
  },
  SOL: {
    name: 'Solana', rank: 5, marketCap: '2.6T TWD',
    circulatingSupply: '440,000,000 SOL', maxSupply: '無上限',
    circulationRate: 75.8, volume24h: '180B TWD',
    ath: { price: '8,200', date: '2025/01/19' },
    atl: { price: '28', date: '2022/12/29' },
    launchDate: '2020/03/16',
    about: 'Solana 是高性能公鏈，以極低手續費和每秒數千筆交易吞吐量著稱。採用歷史證明（Proof of History）+ PoS 混合共識，主打 DeFi 和 NFT 生態。',
    tags: ['Top 5', '高性能', 'Layer 1', 'PoH'],
  },
}

const DEFAULT_DATA = {
  name: 'Unknown', rank: '-', marketCap: '-',
  circulatingSupply: '-', maxSupply: '-',
  circulationRate: 0, volume24h: '-',
  ath: { price: '-', date: '-' },
  atl: { price: '-', date: '-' },
  launchDate: '-',
  about: '暫無資料',
  tags: [],
}

export default function CoinOverview({ symbol }) {
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
        <MetricCard label="總市值" value={data.marketCap} />
        <MetricCard label="24H 成交額" value={data.volume24h} />
        <MetricCard label="流通量" value={data.circulatingSupply} />
        <MetricCard label="最大供應" value={data.maxSupply} />
        <MetricCard label="流通率" value={`${data.circulationRate}%`} />
        <MetricCard label="發行日期" value={data.launchDate} />
        <MetricCard label="歷史最高 (ATH)" value={`NT$ ${data.ath.price}`} sub={data.ath.date} highlight="up" />
        <MetricCard label="歷史最低 (ATL)" value={`NT$ ${data.atl.price}`} sub={data.atl.date} highlight="down" />
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
