import { useState } from 'react'
import PersonalityBadge from '../shared/PersonalityBadge'
import Avatar from '../shared/Avatar'
import './PostComposer.css'

const COIN_OPTIONS = ['', 'BTC', 'ETH', 'SOL', 'DOGE', 'ADA', 'DOT']

/**
 * 發佈新貼文元件
 * onPost: (post: { content, coin }) => void
 * currentUser: { name, personality }
 */
export default function PostComposer({ onPost, currentUser }) {
  const [content, setContent] = useState('')
  const [coin, setCoin] = useState('')

  const canSubmit = content.trim().length > 0

  const handleSubmit = () => {
    if (!canSubmit) return
    onPost({ content: content.trim(), coin: coin || null })
    setContent('')
    setCoin('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSubmit()
    }
  }

  return (
    <div className="post-composer">
      <div className="composer-header">
        <Avatar name={currentUser.name} className="composer-avatar" />
        <PersonalityBadge personality={currentUser.personality} compact />
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {currentUser.name}
        </span>
      </div>

      <div className="composer-input-area">
        <textarea
          className="composer-textarea"
          placeholder="分享你的投資觀點..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
        />
      </div>

      <div className="composer-footer">
        <div className="composer-options">
          <select
            className="coin-select"
            value={coin}
            onChange={(e) => setCoin(e.target.value)}
          >
            <option value="">選擇幣種（可選）</option>
            {COIN_OPTIONS.filter(Boolean).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <button
          className="composer-submit"
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          發佈
        </button>
      </div>
    </div>
  )
}
