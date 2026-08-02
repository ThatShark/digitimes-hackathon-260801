import { useNavigate } from 'react-router-dom'
import './CopyTradeButton.css'

/**
 * 詢問 AI 建議按鈕
 * 點擊後跳轉到該幣種的 CoinTrendPage，並將貼文內容 + 跟隨意願傳給 AI Chat
 * AI Chat 會顯示貼文縮圖卡片 + 自動送出分析請求
 *
 * @param {object} props
 * @param {object} props.tradeSignal - { action: 'buy'|'sell', coin: string, price?: number }
 * @param {string} props.authorName - 策略發布者名稱
 * @param {string} [props.postContent] - 貼文原文（傳給 AI 分析用）
 */
export default function CopyTradeButton({
  tradeSignal,
  authorName,
  postContent,
}) {
  const navigate = useNavigate()

  if (!tradeSignal) return null

  const isBuy = tradeSignal.action === 'buy'

  const handleClick = () => {
    // 顯示在聊天氣泡中的文字
    const aiMessage = `我想跟隨他的${isBuy ? '買入' : '賣出'}策略。\n請幫我分析這個策略是否適合我，並給我建議。`

    // 附帶貼文卡片資訊（讓 AI Chat 顯示縮圖卡片）
    const attachment = JSON.stringify({
      type: 'post_card',
      author: authorName,
      content: postContent || `${isBuy ? '看多' : '看空'} ${tradeSignal.coin}`,
      action: tradeSignal.action,
      coin: tradeSignal.coin,
      price: tradeSignal.price || null,
    })

    // 送給 AI 的完整 prompt（含貼文上下文，讓 AI 有足夠資訊分析）
    const aiPrompt = [
      `我在社群看到 ${authorName} 的貼文，想跟隨他的${isBuy ? '買入' : '賣出'}策略。`,
      `貼文內容：「${postContent || `${isBuy ? '看多' : '看空'} ${tradeSignal.coin}`}」`,
      `請幫我分析這個策略是否適合我，並給我建議。`,
    ].join('\n')

    // 存入 sessionStorage
    sessionStorage.setItem('ai_chat_prefill', aiMessage)
    sessionStorage.setItem('ai_chat_prompt', aiPrompt)
    sessionStorage.setItem('ai_chat_attachment', attachment)
    sessionStorage.setItem('ai_chat_auto_send', 'true')

    // 跳轉到該幣種頁面（scrollTo top）
    navigate(`/coin/${tradeSignal.coin}`)
    window.scrollTo(0, 0)
  }

  return (
    <button
      className={`copy-trade-btn ${isBuy ? 'buy' : 'sell'}`}
      onClick={handleClick}
    >
      詢問 AI 建議
    </button>
  )
}
