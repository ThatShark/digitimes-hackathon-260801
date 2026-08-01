import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'live_bookmarks'

function readBookmarks() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []
  } catch {
    return []
  }
}

/**
 * 書籤 Hook — 使用 useState + storage event 跨 tab 同步
 * 同一頁面內的多個元件透過 custom event 同步
 */
export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState(readBookmarks)

  // 監聽其他元件的更新（同頁面）和其他 tab 的 storage event
  useEffect(() => {
    const handleUpdate = () => setBookmarks(readBookmarks())
    window.addEventListener('bookmarks-updated', handleUpdate)
    window.addEventListener('storage', handleUpdate)
    return () => {
      window.removeEventListener('bookmarks-updated', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [])

  const toggleBookmark = useCallback((symbol) => {
    const current = readBookmarks()
    let next
    if (current.includes(symbol)) {
      next = current.filter((s) => s !== symbol)
    } else {
      next = [...current, symbol]
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    setBookmarks(next)
    window.dispatchEvent(new Event('bookmarks-updated'))
  }, [])

  const isBookmarked = useCallback((symbol) => {
    return bookmarks.includes(symbol)
  }, [bookmarks])

  return { bookmarks, toggleBookmark, isBookmarked }
}
