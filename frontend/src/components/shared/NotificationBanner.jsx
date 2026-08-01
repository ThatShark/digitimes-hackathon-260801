import { useState, useEffect } from 'react'
import { getNotifications } from '../../services/coinApi'
import { isBackendConfigured } from '../../services/api'
import './NotificationBanner.css'

// 後端未設定或請求失敗時的 fallback 內容，確保畫面不會空白
const MOCK_NOTIFICATIONS = [
  '🚨 BTC 突破 285 萬 TWD，24H 漲幅 +2.3%',
  '🐋 巨鯨警報：500 BTC 從冷錢包轉入 Binance',
  '📊 恐懼貪婪指數降至 38（恐慌），歷史上是進場好時機',
  '🔥 SOL 鏈上活躍度創 30 天新高',
  '📈 PEPE 24H 漲幅 +15.2%，社群討論量暴增',
]

/**
 * 系統通知條
 * 顯示在頁面頂部，輪播市場異動消息。
 * 向後端 GET /notifications 取得動態規則產生的通知（漲跌幅異動、恐懼貪婪指數、
 * 巨鯨警報、社群討論量），失敗或後端未設定時 fallback 回寫死的 mock 內容。
 */
export default function NotificationBanner() {
  const [dismissed, setDismissed] = useState(false)
  const [current, setCurrent] = useState(0)
  const [messages, setMessages] = useState(MOCK_NOTIFICATIONS)

  useEffect(() => {
    if (!isBackendConfigured()) return
    let cancelled = false

    getNotifications()
      .then((data) => {
        if (cancelled) return
        const texts = (data?.notifications || []).map((n) => `${n.icon} ${n.text}`)
        if (texts.length > 0) {
          setMessages(texts)
          setCurrent(0)
        }
      })
      .catch(() => {
        // 保持 mock 內容，不讓通知條消失
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % messages.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [messages])

  if (dismissed) return null

  return (
    <div className="notification-banner">
      <span className="notification-icon">📢</span>
      <span className="notification-text">
        {messages[current]}
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
