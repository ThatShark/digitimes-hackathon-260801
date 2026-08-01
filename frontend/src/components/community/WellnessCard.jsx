import './WellnessCard.css'

const MESSAGES = [
  '虧損是一時的，但人生是一世的。系統關心您。',
  '投資有風險，但你的健康和心情比任何報酬率都重要。',
  '不論漲跌，記得照顧好自己。休息一下也沒關係。',
  '市場永遠都在，先把自己照顧好再回來。',
  '每個人都有低潮的時候，記得你不是一個人。',
  '停損不丟臉，懂得保護自己才是真正的高手。',
]

const HOTLINES = [
  { name: '安心專線', number: '1925', note: '24 小時免費' },
  { name: '生命線', number: '1995', note: '24 小時' },
  { name: '張老師專線', number: '1980', note: '週一至六' },
]

/**
 * 生命關懷卡片 — 隨機出現在社群 feed 中
 */
export default function WellnessCard() {
  // 每次 render 隨機選一則（同一次 session 內固定）
  const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)]

  return (
    <div className="wellness-card">
      <div className="wellness-header">
        <span className="wellness-icon">💚</span>
        <span className="wellness-title">系統關心您</span>
      </div>
      <p className="wellness-message">{msg}</p>
      <div className="wellness-hotlines">
        {HOTLINES.map((h) => (
          <a key={h.number} href={`tel:${h.number}`} className="hotline-chip">
            <span className="hotline-name">{h.name}</span>
            <span className="hotline-number">{h.number}</span>
            <span className="hotline-note">{h.note}</span>
          </a>
        ))}
      </div>
    </div>
  )
}
