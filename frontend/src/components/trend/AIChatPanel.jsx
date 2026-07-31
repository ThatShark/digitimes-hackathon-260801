import { useState, useRef, useEffect, useCallback } from 'react'
import PersonalityBadge from '../shared/PersonalityBadge'
import './AIChatPanel.css'

// Keywords that trigger a mock trade suggestion
const BUY_TRIGGERS = ['買', '進場', 'buy', '加倉', '抄底']
const SELL_TRIGGERS = ['賣', '出場', 'sell', '獲利', '停損']

function generateMockAIResponse(symbol, userMessage) {
  const lowerMsg = userMessage.toLowerCase()
  const isBuy = BUY_TRIGGERS.some((t) => lowerMsg.includes(t))
  const isSell = SELL_TRIGGERS.some((t) => lowerMsg.includes(t))

  if (isBuy) {
    return {
      content: `根據目前恐懼貪婪指數 35（偏恐慌）以及你過去在類似條件下的勝率 62%，我認為現在是不錯的買入時機。`,
      suggestion: { action: 'buy', currency: symbol, amount: 5000, reason: '恐懼指數偏低 + 短期趨勢回升 + 歷史勝率 62%' },
    }
  }
  if (isSell) {
    return {
      content: `目前 ${symbol} 已接近你的平均獲利出場點，恐懼貪婪指數 68（偏貪婪），建議考慮部分獲利了結。`,
      suggestion: { action: 'sell', currency: symbol, amount: 3000, reason: '接近歷史高點 + 恐懼指數偏高 + 建議分批出場' },
    }
  }
  const responses = [
    `${symbol} 目前處於盤整區間，短期 7 日均線持平。建議觀望，等待明確方向再行動。`,
    `根據你的投資人格（熱衷型），你通常在這種盤勢下容易追漲。建議耐心等待回調。`,
    `目前恐懼貪婪指數 52（中性），${symbol} 成交量正常，沒有明顯的進出場訊號。`,
    `分析你過去 30 天的操作，你對 ${symbol} 的勝率是 58%，平均持倉 3.2 天。目前沒有特別建議。`,
  ]
  return { content: responses[Math.floor(Math.random() * responses.length)], suggestion: null }
}

const INITIAL_MESSAGES = [
  { role: 'ai', content: '你好！我是你的 AI 投資助理。你可以問我任何關於投資的問題，或者跟我說「我想買」/「我想賣」來取得建議。' },
]

// Mock community chat users
const MOCK_COMMUNITY_USERS = [
  { name: '王大壯', personality: { code: 'DCLQ', name: '長青樹', axes: { R: 20, E: 25, F: 15, S: 18 } } },
  { name: '陳Ｊ哥', personality: { code: 'AESI', name: '探險家', axes: { R: 82, E: 78, F: 85, S: 70 } } },
  { name: '李小雨', personality: { code: 'DELI', name: '造夢者', axes: { R: 25, E: 65, F: 20, S: 72 } } },
  { name: '趙柏翰', personality: { code: 'ACSQ', name: '狙擊手', axes: { R: 75, E: 22, F: 80, S: 15 } } },
]

const MOCK_CHAT_TEXTS = [
  '支撐位在 282 萬附近',
  '看多🚀',
  '剛加倉了一些',
  '量能不太夠啊',
  '等突破再說',
  '穩穩抱住就好',
  '有人知道為什麼突然漲了嗎',
  '恐懼指數還很低 可以衝',
  '小心追高',
  '底部確認了嗎',
  '我覺得還會再跌',
]

/**
 * 判斷是否應該自動捲動：
 * - 內容尚未填滿容器（scrollHeight <= clientHeight）時：始終捲動
 * - 內容已填滿時：只有用戶在底部附近才捲動
 */
function shouldAutoScroll(container) {
  if (!container) return true
  // 內容尚未填滿
  if (container.scrollHeight <= container.clientHeight + 10) return true
  // 已在底部附近（60px 容差）
  return container.scrollHeight - container.scrollTop - container.clientHeight < 60
}

/**
 * @param {object} props
 * @param {string} props.symbol - 幣種
 * @param {function} [props.onDanmaku] - 彈幕同步回調 (msg: {user, text, id}) => void
 */
export default function AIChatPanel({ symbol, onDanmaku }) {
  const [activeTab, setActiveTab] = useState('ai')
  const [messages, setMessages] = useState(INITIAL_MESSAGES)
  const [communityMessages, setCommunityMessages] = useState([])
  const [input, setInput] = useState('')
  const [pendingSuggestion, setPendingSuggestion] = useState(null)
  const aiScrollRef = useRef(null)
  const communityScrollRef = useRef(null)
  const messagesEndRef = useRef(null)
  const communityEndRef = useRef(null)
  const aiScrollRef = useRef(null)
  const communityScrollRef = useRef(null)

  // Auto-scroll AI chat
  useEffect(() => {
    const container = aiScrollRef.current
    if (activeTab === 'ai' && shouldAutoScroll(container)) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, pendingSuggestion, activeTab])

  // Auto-scroll community chat
  useEffect(() => {
    const container = communityScrollRef.current
    if (activeTab === 'community' && shouldAutoScroll(container)) {
      communityEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [communityMessages, activeTab])

  // 新增社群訊息並同步到彈幕
  const addCommunityMessage = useCallback((user, text, isMe = false) => {
    const msg = {
      id: Date.now() + Math.random(),
      user,
      text,
      time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
      isMe,
    }
    setCommunityMessages((prev) => [...prev.slice(-50), msg])

    // 同步到彈幕 overlay（用名字而非人格代碼）
    onDanmaku?.({ user: user.name, text, id: msg.id })
  }, [onDanmaku])

  // Mock community chat auto-generation
  useEffect(() => {
    const timer = setInterval(() => {
      const user = MOCK_COMMUNITY_USERS[Math.floor(Math.random() * MOCK_COMMUNITY_USERS.length)]
      const text = MOCK_CHAT_TEXTS[Math.floor(Math.random() * MOCK_CHAT_TEXTS.length)]
      addCommunityMessage(user, text)
    }, 3000)
    return () => clearInterval(timer)
  }, [addCommunityMessage])

  const handleSend = () => {
    if (!input.trim()) return
    const userMsg = input.trim()
    setInput('')

    if (activeTab === 'ai') {
      setMessages((prev) => [...prev, { role: 'user', content: userMsg }])
      setTimeout(() => {
        const response = generateMockAIResponse(symbol, userMsg)
        setMessages((prev) => [...prev, { role: 'ai', content: response.content }])
        if (response.suggestion) setPendingSuggestion(response.suggestion)
      }, 600)
    } else {
      const me = { name: '我', personality: { code: 'ACSI', name: '弄潮兒', axes: { R: 68, E: 30, F: 75, S: 62 } } }
      addCommunityMessage(me, userMsg, true)
    }
  }

  const handleConfirmTrade = () => {
    if (!pendingSuggestion) return
    const { action, currency, amount } = pendingSuggestion
    setMessages((prev) => [
      ...prev,
      { role: 'system', content: `✅ 已成功${action === 'buy' ? '買入' : '賣出'} NT$${amount.toLocaleString()} 的 ${currency}` },
    ])
    setPendingSuggestion(null)
  }

  const handleRejectTrade = () => {
    setMessages((prev) => [...prev, { role: 'system', content: '❌ 已取消交易建議' }])
    setPendingSuggestion(null)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="ai-chat-panel">
      {/* Tab header */}
      <div className="chat-panel-header">
        <button
          className={`chat-tab ${activeTab === 'ai' ? 'active' : ''}`}
          onClick={() => setActiveTab('ai')}
        >
          🤖 AI 對話
        </button>
        <button
          className={`chat-tab ${activeTab === 'community' ? 'active' : ''}`}
          onClick={() => setActiveTab('community')}
        >
          💬 彈幕聊天
        </button>
      </div>

      {/* AI Chat tab */}
      {activeTab === 'ai' && (
        <div className="chat-messages" ref={aiScrollRef}>
          {messages.map((msg, i) => (
            <div key={i} className={`chat-message ${msg.role}`}>
              <div className="message-bubble">{msg.content}</div>
            </div>
          ))}

          {pendingSuggestion && (
            <div className="trade-suggestion-card">
              <div className="suggestion-header">
                <span className={`suggestion-action ${pendingSuggestion.action}`}>
                  {pendingSuggestion.action === 'buy' ? '📈 建議買入' : '📉 建議賣出'}
                </span>
              </div>
              <div className="suggestion-details">
                <div className="suggestion-row">
                  <span className="suggestion-label">幣種</span>
                  <span className="suggestion-value">{pendingSuggestion.currency}</span>
                </div>
                <div className="suggestion-row">
                  <span className="suggestion-label">金額</span>
                  <span className="suggestion-value">NT$ {pendingSuggestion.amount.toLocaleString()}</span>
                </div>
                <div className="suggestion-row">
                  <span className="suggestion-label">原因</span>
                  <span className="suggestion-value reason">{pendingSuggestion.reason}</span>
                </div>
              </div>
              <div className="suggestion-actions">
                <button className="suggestion-btn confirm" onClick={handleConfirmTrade}>✓ 確認執行</button>
                <button className="suggestion-btn reject" onClick={handleRejectTrade}>✕ 取消</button>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Community Chat tab */}
      {activeTab === 'community' && (
        <div className="chat-messages community-chat" ref={communityScrollRef}>
          {communityMessages.length === 0 && (
            <div className="community-empty"><span>等待群友加入聊天...</span></div>
          )}
          {communityMessages.map((msg) => (
            <div key={msg.id} className={`community-msg ${msg.isMe ? 'me' : ''}`}>
              <div className="community-msg-header">
                <span className="community-msg-name">{msg.user.name}</span>
                <PersonalityBadge personality={msg.user.personality} compact />
                <span className="community-msg-time">{msg.time}</span>
              </div>
              <div className="community-msg-text">{msg.text}</div>
            </div>
          ))}
          <div ref={communityEndRef} />
        </div>
      )}

      {/* Input area */}
      <div className="chat-input-area">
        <input
          type="text"
          className="chat-input"
          placeholder={activeTab === 'ai' ? `詢問關於 ${symbol} 的問題...` : '發送彈幕...'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button className="chat-send-btn" onClick={handleSend}>➤</button>
      </div>
    </div>
  )
}
