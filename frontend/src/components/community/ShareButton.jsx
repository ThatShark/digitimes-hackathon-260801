import { useState, useRef, useEffect } from 'react'
import './ShareButton.css'

/**
 * 分享按鈕 — 點擊後彈出貼文網址，可一鍵複製
 *
 * @param {object} props
 * @param {string} props.postId - 貼文 ID，用來組出分享網址 /community/post/:postId
 */
export default function ShareButton({ postId }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const wrapperRef = useRef(null)

  const shareUrl = `${window.location.origin}/community/post/${postId}`

  // 點擊外部關閉彈出視窗
  useEffect(() => {
    if (!open) return
    const handleClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const handleToggle = (e) => {
    e.stopPropagation()
    setOpen((prev) => !prev)
  }

  const handleCopy = async (e) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(shareUrl)
    } catch {
      // Clipboard API 不可用時的後備方案（例如非 HTTPS 環境）
      const input = document.createElement('input')
      input.value = shareUrl
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <span className="share-button-wrapper" ref={wrapperRef} onClick={(e) => e.stopPropagation()}>
      <button className="post-action-btn share-btn" onClick={handleToggle} title="分享">
        <span className="action-icon">🔗</span>
      </button>

      {open && (
        <div className="share-popover">
          <div className="share-popover-title">分享貼文</div>
          <div className="share-url-row">
            <input
              className="share-url-input"
              type="text"
              readOnly
              value={shareUrl}
              onClick={(e) => e.target.select()}
            />
            <button className="share-copy-btn" onClick={handleCopy}>
              {copied ? '已複製 ✓' : '複製'}
            </button>
          </div>
        </div>
      )}
    </span>
  )
}
