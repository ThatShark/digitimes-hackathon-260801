import './PersonalityBadge.css'

/**
 * REFS 16 型投資人格 Badge
 *
 * personality: {
 *   code: 'ACSQ',           // 4 字元代碼 [R][E][F][S]
 *   name: '狙擊手',          // 人格名稱
 *   axes: {
 *     R: 72,  // 0-100, 高=Aggressive, 低=Defensive
 *     E: 35,  // 0-100, 高=Emotional, 低=Calm
 *     F: 80,  // 0-100, 高=Short-term, 低=Long-term
 *     S: 90,  // 0-100, 高=Intuitive, 低=Quantitative
 *   }
 * }
 *
 * compact: 只顯示代碼不顯示占比條 (用於彈幕等空間有限的地方)
 */

const AXIS_CONFIG = [
  { key: 'R', labelLow: 'D', labelHigh: 'A', colorLow: '#34d399', colorHigh: '#f87171', nameLow: '防守', nameHigh: '進攻' },
  { key: 'E', labelLow: 'C', labelHigh: 'E', colorLow: '#60a5fa', colorHigh: '#fbbf24', nameLow: '冷靜', nameHigh: '熱情' },
  { key: 'F', labelLow: 'L', labelHigh: 'S', colorLow: '#a78bfa', colorHigh: '#fb923c', nameLow: '長期', nameHigh: '短期' },
  { key: 'S', labelLow: 'I', labelHigh: 'Q', colorLow: '#f472b6', colorHigh: '#2dd4bf', nameLow: '直覺', nameHigh: '量化' },
]

export default function PersonalityBadge({ personality, compact = false, showName = false }) {
  if (!personality) return null

  // 支援舊格式：若傳入字串，僅顯示代碼
  if (typeof personality === 'string') {
    return (
      <span className="personality-badge personality-badge--compact" title={`投資人格：${personality}`}>
        {personality}
      </span>
    )
  }

  const { code, name, axes } = personality

  if (compact) {
    return (
      <span className="personality-badge personality-badge--compact" title={`${code} ${name || ''}`}>
        <span className="pb-compact-code">{code}</span>
        {showName && name && <span className="pb-compact-name">{name}</span>}
      </span>
    )
  }

  return (
    <div className="personality-badge personality-badge--full" title={name ? `${code}・${name}` : code}>
      <div className="pb-header">
        <span className="pb-code">{code}</span>
        {name && <span className="pb-name">{name}</span>}
      </div>
      <div className="pb-axes">
        {AXIS_CONFIG.map((axis) => {
          const value = axes?.[axis.key] ?? 50
          return (
            <div className="pb-axis" key={axis.key}>
              <span className="pb-axis-label pb-axis-label--low" style={{ color: axis.colorLow }}>
                {axis.labelLow} {axis.nameLow}
              </span>
              <div className="pb-bar">
                <div
                  className="pb-bar-fill pb-bar-fill--low"
                  style={{ width: `${100 - value}%`, background: axis.colorLow }}
                />
                <div
                  className="pb-bar-fill pb-bar-fill--high"
                  style={{ width: `${value}%`, background: axis.colorHigh }}
                />
              </div>
              <span className="pb-axis-label pb-axis-label--high" style={{ color: axis.colorHigh }}>
                {axis.nameHigh} {axis.labelHigh}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
