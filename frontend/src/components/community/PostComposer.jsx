import { useState, useRef } from 'react'
import PersonalityBadge from '../shared/PersonalityBadge'
import Avatar from '../shared/Avatar'
import './PostComposer.css'

const COIN_OPTIONS = ['', 'BTC', 'ETH', 'SOL', 'DOGE', 'ADA', 'DOT']
const MAX_IMAGES = 4

/**
 * 發佈新貼文元件
 * onPost: (post: { content, coin, images }) => void
 * onBounty: (bounty: { question, coin, images }) => void (optional)
 * currentUser: { name, personality }
 */
export default function PostComposer({ onPost, onBounty, currentUser }) {
  const [content, setContent] = useState('')
  const [coin, setCoin] = useState('')
  const [mode, setMode] = useState('post') // 'post' | 'bounty'
  const [images, setImages] = useState([]) // blob URL 陣列
  const fileInputRef = useRef(null)

  const canSubmit = content.trim().length > 0

  const handleSubmit = () => {
    if (!canSubmit) return
    if (mode === 'bounty' && onBounty) {
      onBounty({ question: content.trim(), coin: coin || null, images })
    } else {
      onPost({ content: content.trim(), coin: coin || null, images })
    }
    setContent('')
    setCoin('')
    setImages([])
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSubmit()
    }
  }

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    const remaining = MAX_IMAGES - images.length
    const newUrls = files.slice(0, remaining).map((f) => URL.createObjectURL(f))
    setImages((prev) => [...prev, ...newUrls])
    e.target.value = ''
  }

  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
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

      {/* 模式切換 */}
      <div className="composer-mode-toggle">
        <button
          type="button"
          className={`composer-mode-btn ${mode === 'post' ? 'active' : ''}`}
          onClick={() => setMode('post')}
        >
          💬 發佈貼文
        </button>
        <button
          type="button"
          className={`composer-mode-btn ${mode === 'bounty' ? 'active' : ''}`}
          onClick={() => setMode('bounty')}
        >
          ❓ 懸賞提問
        </button>
      </div>

      <div className="composer-input-area">
        <textarea
          className="composer-textarea"
          placeholder={mode === 'bounty' ? '描述你的問題，等待社群高手回答...' : '分享你的投資觀點...'}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
        />
      </div>

      {/* 圖片預覽 */}
      {images.length > 0 && (
        <div className="composer-image-preview">
          {images.map((src, i) => (
            <div key={i} className="composer-image-item">
              <img src={src} alt="" className="composer-image-thumb" />
              <button
                type="button"
                className="composer-image-remove"
                onClick={() => removeImage(i)}
              >✕</button>
            </div>
          ))}
        </div>
      )}

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
          <input
            type="file"
            accept="image/*"
            multiple
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleImageSelect}
          />
          <button
            type="button"
            className="composer-image-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={images.length >= MAX_IMAGES}
            title={images.length >= MAX_IMAGES ? `最多 ${MAX_IMAGES} 張圖片` : '新增圖片'}
          >
            🖼️ {images.length > 0 ? `${images.length}/${MAX_IMAGES}` : ''}
          </button>
        </div>
        <button
          className="composer-submit"
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          {mode === 'bounty' ? '發佈懸賞' : '發佈'}
        </button>
      </div>
    </div>
  )
}
