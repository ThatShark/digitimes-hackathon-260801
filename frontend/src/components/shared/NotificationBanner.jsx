import { useState, useEffect } from 'react'
import './NotificationBanner.css'

const NOTIFICATIONS = [
  '🚨 BTC 突破 285 萬 TWD，24H 漲幅 +2.3%',
  '🐋 巨鯨警報：500 BTC 從冷錢包轉入 Binance',
  '📊 恐懼貪婪指數降至 38（恐慌），歷史上是進場好時機',
  '🔥 SOL 鏈上活躍度創 30 天新高',
  '📈 PEPE 24H 漲幅 +15.2%，社群討論量暴增',
]

/**
 * 系統通知條
 * 顯示在頁面頂部，輪播市場異動消息
 */
export default function NotificationBanner() {
  const [dismissed, setDismissed] = useState(false)
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % NOTIFICATIONS.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [])

  if (dismissed) return null

  return (
    <div className="notification-banner">
      <span className="notification-icon">📢</span>
      <span className="notification-text">
        {NOTIFICATIONS[current]}
      </span>
      <button
        className="notification-dismiss"
        onClick={() => setDismissed(true)}
        aria-label="關閉通知"
      >
        ✕
      </button>
    </div>
  )
}
