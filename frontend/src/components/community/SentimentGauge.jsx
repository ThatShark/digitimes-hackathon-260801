import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import './SentimentGauge.css'

// 多空關鍵詞（簡易版前端 NLP）
const BULLISH_KEYWORDS = [
  '看多', '起飛', '買入', 'all-in', '突破', '利多', '進場',
  '加倉', '拉盤', '暴漲', '底部', '翻倍', '牛市', '上漲',
  '漲', '衝', '🚀', '📈',
]

const BEARISH_KEYWORDS = [
  '看空', '崩盤', '賣出', '停損', '下跌', '利空', '逃跑',
  '減倉', '砸盤', '暴跌', '頂部', '腰斬', '熊市', '跌',
  '小心', '風險', '撤', '📉',
]

/**
 * 社群情緒儀表盤
 * 掃描貼文內容，計算看多/看空比例
 * 
 * @param {object} props
 * @param {Array} props.posts - 貼文陣列 [{content: string}]
 * @param {string} [props.coin] - 篩選特定幣種（可選）
 * @param {string} [props.linkTo] - 點擊跳轉的路由（可選）
 */
export default function SentimentGauge({ posts, coin, linkTo }) {
  const navigate = useNavigate()
  const sentiment = useMemo(() => {
    const relevantPosts = coin
      ? posts.filter((p) => p.coin === coin || p.content.includes(coin))
      : posts

    let bullish = 0
    let bearish = 0

    relevantPosts.forEach((post) => {
      const text = post.content.toLowerCase()
      BULLISH_KEYWORDS.forEach((kw) => {
        if (text.includes(kw.toLowerCase())) bullish++
      })
      BEARISH_KEYWORDS.forEach((kw) => {
        if (text.includes(kw.toLowerCase())) bearish++
      })
    })

    const total = bullish + bearish
    if (total === 0) return { bullishPct: 50, bearishPct: 50, total: 0 }

    return {
      bullishPct: Math.round((bullish / total) * 100),
      bearishPct: Math.round((bearish / total) * 100),
      total,
    }
  }, [posts, coin])

  const label = sentiment.bullishPct >= 60
    ? '偏多'
    : sentiment.bearishPct >= 60
      ? '偏空'
      : '中性'

  const labelClass = sentiment.bullishPct >= 60
    ? 'bullish'
    : sentiment.bearishPct >= 60
      ? 'bearish'
      : 'neutral'

  const handleClick = () => {
    if (linkTo) navigate(linkTo)
  }

  return (
    <div
      className={`sentiment-gauge ${linkTo ? 'clickable' : ''}`}
      onClick={handleClick}
      role={linkTo ? 'link' : undefined}
      title={linkTo ? `前往 ${coin} 幣種頁面` : undefined}
    >      <div className="sentiment-header">
        <span className="sentiment-title">
          {coin && <span className="sentiment-star">★</span>}
          社群情緒 {coin && <span className="sentiment-coin">{coin}</span>}
        </span>
        <span className={`sentiment-label ${labelClass}`}>{label}</span>
      </div>

      <div className="sentiment-bar">
        <div
          className="sentiment-bar-bull"
          style={{ width: `${sentiment.bullishPct}%` }}
        />
        <div
          className="sentiment-bar-bear"
          style={{ width: `${sentiment.bearishPct}%` }}
        />
      </div>

      <div className="sentiment-legends">
        <span className="sentiment-legend bull">
          📈 看多 {sentiment.bullishPct}%
        </span>
        <span className="sentiment-legend bear">
          📉 看空 {sentiment.bearishPct}%
        </span>
      </div>

      {sentiment.total === 0 && (
        <p className="sentiment-empty">目前社群討論不足，無法判斷情緒</p>
      )}
    </div>
  )
}
