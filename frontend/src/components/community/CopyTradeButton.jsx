import { useState } from 'react'
import './CopyTradeButton.css'

/**
 * 跟單按鈕 + 確認 Modal
 * 當貼文包含交易信號時顯示
 * 
 * @param {object} props
 * @param {object} props.tradeSignal - { action: 'buy'|'sell', coin: string, price?: number }
 * @param {string} props.authorName - 策略發布者名稱
 * @param {object} [props.authorPersonality] - 策略發布者人格
 * @param {object} [props.userPersonality] - 當前用戶人格（用於風險比對）
 */
export default function CopyTradeButton({
  tradeSignal,
  authorName,
  authorPersonality,
  userPersonality,
}) {
  const [showModal, setShowModal] = useState(false)
  const [amount, setAmount] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  if (!tradeSignal) return null

  const isBuy = tradeSignal.action === 'buy'
  const riskMismatch = checkRiskMismatch(authorPersonality, userPersonality)

  const handleConfirm = () => {
    setConfirmed(true)
    setShowModal(false)
    // 實際會呼叫 /copy_trade API
    setTimeout(() => setConfirmed(false), 3000)
  }

  return (
    <>
      <button
        className={`copy-trade-btn ${isBuy ? 'buy' : 'sell'}`}
        onClick={() => setShowModal(true)}
        disabled={confirmed}
      >
        {confirmed
          ? '✓ 已跟隨'
          : `跟隨${isBuy ? '買入' : '賣出'} ${tradeSignal.coin}`
        }
      </button>

      {showModal && (
        <div className="copy-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="copy-modal" onClick={(e) => e.stopPropagation()}>
            <div className="copy-modal-header">
              <h3>跟隨交易策略</h3>
              <button
                className="copy-modal-close"
                onClick={() => setShowModal(false)}
                aria-label="關閉"
              >
                ✕
              </button>
            </div>

            <div className="copy-modal-body">
              <div className="copy-strategy-info">
                <div className="copy-info-row">
                  <span className="copy-info-label">策略者</span>
                  <span className="copy-info-value">{authorName}</span>
                </div>
                <div className="copy-info-row">
                  <span className="copy-info-label">方向</span>
                  <span className={`copy-info-value ${isBuy ? 'buy' : 'sell'}`}>
                    {isBuy ? '📈 買入' : '📉 賣出'}
                  </span>
                </div>
                <div className="copy-info-row">
                  <span className="copy-info-label">幣種</span>
                  <span className="copy-info-value">{tradeSignal.coin}</span>
                </div>
                {tradeSignal.price && (
                  <div className="copy-info-row">
                    <span className="copy-info-label">建議價格</span>
                    <span className="copy-info-value">
                      NT$ {tradeSignal.price.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              {riskMismatch && (
                <div className="copy-risk-warning">
                  <span className="risk-icon">⚠️</span>
                  <span className="risk-text">
                    此策略者的風險偏好與你不同，請謹慎評估是否跟隨。
                  </span>
                </div>
              )}

              <div className="copy-amount-section">
                <label className="copy-amount-label">投入金額 (TWD)</label>
                <input
                  type="number"
                  className="copy-amount-input"
                  placeholder="輸入金額"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="100"
                />
              </div>
            </div>

            <div className="copy-modal-footer">
              <button
                className="copy-cancel-btn"
                onClick={() => setShowModal(false)}
              >
                取消
              </button>
              <button
                className={`copy-confirm-btn ${isBuy ? 'buy' : 'sell'}`}
                onClick={handleConfirm}
                disabled={!amount || Number(amount) < 100}
              >
                確認{isBuy ? '買入' : '賣出'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/**
 * 比對策略者與跟單者的風險軸差異
 */
function checkRiskMismatch(authorP, userP) {
  if (!authorP?.axes || !userP?.axes) return false
  // R 軸代表風險偏好，差異超過 40 時警示
  const authorRisk = authorP.axes.R || 50
  const userRisk = userP.axes.R || 50
  return Math.abs(authorRisk - userRisk) > 40
}
