import { useState, useRef } from 'react'
import PersonalityBadge from '../shared/PersonalityBadge'
import './CommentComposer.css'

/**
 * 留言輸入框（用於貼文詳情頁底部）
 * 支援文字 + 附加圖片（mock：轉成本地 blob URL 預覽）
 *
 * @param {object} props
 * @param {object} props.currentUser - { name, personality }
 * @param {function} props.onSubmit - (content: string, images: string[]) => void
 * @param {number} [props.floor] - 若提供則顯示「回覆 #N 樓」提示（保留擴充用，目前留言無巢狀）
 */
export default function CommentComposer({ currentUser, onSubmit }) {
  const [content, setContent] = useState('')
  const [images, setImages] = useState([])
  const fileInputRef = useRef(null)

  const canSubmit = content.trim().length > 0 || images.length > 0

  const handleAddImage = (e) => {
    const files = Array.from(e.target.files || [])
    const urls = files.map((file) => URL.createObjectURL(file))
    setImages((prev) => [...prev, ...urls].slice(0, 4))
    e.target.value = ''
  }

  const handleRemoveImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = () => {
    if (!canSubmit) return
    onSubmit(content.trim(), images)
    setContent('')
    setImages([])
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSubmit()
    }
  }

  return (
    <div className="comment-composer">
      <div className="comment-composer-avatar">{currentUser.name.charAt(0)}</div>

      <div className="comment-composer-main">
        <div className="comment-composer-name-row">
          <PersonalityBadge personality={currentUser.personality} compact />
          <span className="comment-composer-name">{currentUser.name}</span>
        </div>

        <textarea
          className="comment-composer-textarea"
          placeholder="留下你的看法..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
        />

        {images.length > 0 && (
          <div className="comment-composer-images">
            {images.map((src, i) => (
              <div key={src} className="comment-composer-image-preview">
                <img src={src} alt="" />
                <button
                  className="comment-composer-image-remove"
                  onClick={() => handleRemoveImage(i)}
                  aria-label="移除圖片"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="comment-composer-footer">
          <button
            className="comment-composer-image-btn"
            onClick={() => fileInputRef.current?.click()}
            title="附加圖片"
          >
            🖼️
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={handleAddImage}
          />

          <button
            className="comment-composer-submit"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            送出
          </button>
        </div>
      </div>
    </div>
  )
}
