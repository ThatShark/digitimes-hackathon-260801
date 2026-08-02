import { useState, useEffect } from 'react'
import './ImageLightbox.css'

/**
 * 圖片放大 Lightbox
 * 點擊圖片後全螢幕顯示，點擊背景或 ✕ 關閉
 * 支援左右切換（多圖時）
 */
export default function ImageLightbox({ images, initialIndex = 0, onClose }) {
  const [current, setCurrent] = useState(initialIndex)

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') setCurrent((p) => (p > 0 ? p - 1 : images.length - 1))
      if (e.key === 'ArrowRight') setCurrent((p) => (p < images.length - 1 ? p + 1 : 0))
    }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [images.length, onClose])

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <button className="lightbox-close" onClick={onClose}>✕</button>

      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        <img src={images[current]} alt="" className="lightbox-image" />
      </div>

      {images.length > 1 && (
        <>
          <button
            className="lightbox-nav lightbox-prev"
            onClick={(e) => { e.stopPropagation(); setCurrent((p) => (p > 0 ? p - 1 : images.length - 1)) }}
          >
            ‹
          </button>
          <button
            className="lightbox-nav lightbox-next"
            onClick={(e) => { e.stopPropagation(); setCurrent((p) => (p < images.length - 1 ? p + 1 : 0)) }}
          >
            ›
          </button>
          <div className="lightbox-counter">{current + 1} / {images.length}</div>
        </>
      )}
    </div>
  )
}
