import { useBookmarks } from '../../hooks/useBookmarks'
import './BookmarkButton.css'

/**
 * 書籤按鈕 — 加入/移除重點關注
 * @param {string} symbol - 幣種代號
 * @param {string} [size] - 'sm' | 'md'
 */
export default function BookmarkButton({ symbol, size = 'md' }) {
  const { isBookmarked, toggleBookmark } = useBookmarks()
  const active = isBookmarked(symbol)

  return (
    <button
      className={`bookmark-btn ${size} ${active ? 'active' : ''}`}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleBookmark(symbol) }}
      title={active ? '移除重點關注' : '加入重點關注'}
      aria-label={active ? '移除重點關注' : '加入重點關注'}
    >
      {active ? '★' : '☆'}
    </button>
  )
}
