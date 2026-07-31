import { useState } from 'react'
import PersonalityBadge from '../shared/PersonalityBadge'
import './BountyQuestion.css'

/**
 * 付費懸賞提問卡片
 * 顯示在社群 feed 中，新手可附積分賞金提問
 * 
 * @param {object} props
 * @param {object} props.bounty - { id, author, personality, question, reward, coin, answers, time }
 */
export default function BountyQuestion({ bounty }) {
  const [showAnswer, setShowAnswer] = useState(false)
  const [answered, setAnswered] = useState(false)

  const handleAnswer = () => {
    setAnswered(true)
    // 實際會呼叫 POST /bounty API
  }

  return (
    <div className="bounty-card">
      <div className="bounty-header">
        <span className="bounty-tag">💎 懸賞提問</span>
        <span className="bounty-reward">+{bounty.reward} 積分</span>
      </div>

      <div className="bounty-author-row">
        <div className="bounty-avatar">{bounty.author.charAt(0)}</div>
        <PersonalityBadge personality={bounty.personality} compact />
        <span className="bounty-author-name">{bounty.author}</span>
        <span className="bounty-time">{bounty.time}</span>
      </div>

      <p className="bounty-question">{bounty.question}</p>

      {bounty.coin && (
        <span className="bounty-coin-tag">{bounty.coin}</span>
      )}

      <div className="bounty-footer">
        <span className="bounty-answers-count">
          {bounty.answers || 0} 個回答
        </span>

        {!answered ? (
          <button
            className="bounty-answer-btn"
            onClick={() => setShowAnswer(!showAnswer)}
          >
            我來回答
          </button>
        ) : (
          <span className="bounty-answered">✓ 已提交回答</span>
        )}
      </div>

      {showAnswer && !answered && (
        <div className="bounty-answer-area">
          <textarea
            className="bounty-answer-input"
            placeholder="分享你的見解..."
            rows={3}
          />
          <button className="bounty-submit-btn" onClick={handleAnswer}>
            提交回答（領取 {bounty.reward} 積分）
          </button>
        </div>
      )}
    </div>
  )
}
