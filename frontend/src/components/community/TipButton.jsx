import { useState } from 'react'
import './TipButton.css'

const TIP_AMOUNTS = [1, 5, 10, 50]

/**
 * 微額打賞按鈕（虛擬積分制）
 * 
 * @param {object} props
 * @param {number} props.postId - 貼文 ID
 * @param {number} [props.initialTips] - 初始累計打賞數
 * @param {function} [props.onTip] - 打賞回調 (postId, amount) => void
 */
export default function TipButton({ postId, initialTips = 0, onTip }) {
  const [tipCount, setTipCount] = useState(initialTips)
  const [showPicker, setShowPicker] = useState(false)
  const [justTipped, setJustTipped] = useState(false)

  const handleTip = (amount) => {
    setTipCount((prev) => prev + amount)
    setShowPicker(false)
    setJustTipped(true)
    onTip?.(postId, amount)

    setTimeout(() => setJustTipped(false), 1500)
  }

  return (
    <span className="tip-button-wrapper">
      <button
        className={`post-action-btn tip-btn ${justTipped ? 'tipped' : ''}`}
        onClick={() => setShowPicker(!showPicker)}
        title="打賞"
      >
        <span className="action-icon">{justTipped ? '✨' : '💎'}</span>
        {tipCount > 0 && <span className="action-count">{tipCount}</span>}
      </button>

      {showPicker && (
        <div className="tip-picker">
          <div className="tip-picker-title">打賞積分</div>
          <div className="tip-picker-options">
            {TIP_AMOUNTS.map((amount) => (
              <button
                key={amount}
                className="tip-amount-btn"
                onClick={() => handleTip(amount)}
              >
                +{amount}
              </button>
            ))}
          </div>
        </div>
      )}
    </span>
  )
}
