import { useState } from 'react'
import './ShareButton.css'

/**
 * 分享按鈕 — 支援複製連結、生成卡片、社交分享
 */
export default function ShareButton({ symbol }) {
  const [showMenu, setShowMenu] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    const url = `${window.location.origin}/coin/${symbol}`
    navigator.clipboard?.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    setShowMenu(false)
  }

  const handleShare = (platform) => {
    setShowMenu(false)
    // Mock: 實際會呼叫分享 API
  }

  return (
    <div className="share-button-wrapper">
      <button
        className="share-trigger"
        onClick={() => setShowMenu(!showMenu)}
      >
        🔗 分享
      </button>

      {showMenu && (
        <div className="share-menu">
          <button className="share-option" onClick={handleCopy}>
            {copied ? '✓ 已複製' : '📋 複製連結'}
          </button>
          <button className="share-option" onClick={() => handleShare('image')}>
            🖼️ 生成長圖卡片
          </button>
          <button className="share-option" onClick={() => handleShare('line')}>
            💬 分享到 Line
          </button>
          <button className="share-option" onClick={() => handleShare('ig')}>
            📷 分享到 IG
          </button>
        </div>
      )}
    </div>
  )
}
