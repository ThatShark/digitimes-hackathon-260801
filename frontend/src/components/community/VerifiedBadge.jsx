import './VerifiedBadge.css'

/**
 * 實盤驗證標籤
 * 顯示於已上傳 CSV 且有真實績效數據的用戶貼文上
 * 
 * @param {object} props
 * @param {number} [props.winRate] - 勝率百分比
 * @param {boolean} [props.compact] - 精簡模式（只顯示圖標+文字）
 */
export default function VerifiedBadge({ winRate, compact = false }) {
  return (
    <span className={`verified-badge ${compact ? 'compact' : ''}`}>
      <span className="verified-icon">✓</span>
      <span className="verified-text">實盤</span>
      {!compact && winRate !== undefined && (
        <span className="verified-winrate">勝率 {winRate}%</span>
      )}
    </span>
  )
}
