import { useState } from 'react'
import { Link } from 'react-router-dom'
import './QuestionnaireCard.css'

/**
 * 問卷廣告卡 — 在社群 feed 中穿插出現
 * onDismiss: () => void  隱藏此卡片
 */
export default function QuestionnaireCard({ onDismiss }) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  const handleDismiss = () => {
    setDismissed(true)
    onDismiss?.()
  }

  return (
    <div className="questionnaire-card">
      <button
        className="questionnaire-dismiss"
        onClick={handleDismiss}
        title="關閉"
        aria-label="關閉問卷提示"
      >
        ✕
      </button>

      <span className="questionnaire-tag">📋 人格測驗</span>

      <h3 className="questionnaire-title">
        想知道你是哪種投資人嗎？
      </h3>

      <p className="questionnaire-desc">
        完成 2 分鐘快速問卷，系統將根據你的回答校準投資人格分析，給你更精準的建議。
      </p>

      <Link to="/questionnaire" className="questionnaire-cta">
        開始測驗 →
      </Link>
    </div>
  )
}
