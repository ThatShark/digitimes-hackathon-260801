import { useState, useRef, useEffect, useCallback } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import PersonalityBadge from '../shared/PersonalityBadge'
import { sendAiChat, saveChatHistory, allowTrade } from '../../services/aiApi'
import './AIChatPanel.css'

const INITIAL_MESSAGES = [
  { role: 'ai', content: '你好！我是你的 AI 投資助理。你可以問我任何關於投資的問題，或者跟我說「我想買」/「我想賣」來取得建議。' },
]

// AI 回覆可能包含 Markdown（表格、粗體等）以及少量原始 HTML（如 <br>）。
// rehypeRaw 讓 react-markdown 解析原始 HTML，但必須搭配 rehypeSanitize
// 過濾掉危險標籤/屬性（例如 <script>、onerror=...），避免 AI 回覆內容
// 被用來做 XSS 注入。remarkGfm 則讓表格語法（| --- |）能被正確解析。
const MARKDOWN_REMARK_PLUGINS = [remarkGfm]
const MARKDOWN_REHYPE_PLUGINS = [rehypeRaw, [rehypeSanitize, defaultSchema]]

/**
 * 判斷容器目前是否停在底部附近（100px 容差）。
 * 內容尚未填滿容器時視為在底部。
 */
function isNearBottom(container) {
  if (!container) return true
  if (container.scrollHeight <= container.clientHeight + 10) return true
  return container.scrollHeight - container.scrollTop - container.clientHeight < 100
}

/**
 * @param {object} props
 * @param {string} props.symbol - 幣種
 * @param {Array} props.communityMessages - 聊天室訊息（由父層統一管理，與彈幕同源）
 * @param {function} props.onSendCommunity - 發送聊天室訊息 (text: string) => void
 */
export default function AIChatPanel({ symbol, communityMessages = [], onSendCommunity }) {
  const [activeTab, setActiveTab] = useState('ai')
  const [messages, setMessages] = useState(INITIAL_MESSAGES)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [pendingSuggestion, setPendingSuggestion] = useState(null)
  // 是否顯示「跳到最新訊息」按鈕
  const [showJumpToLatest, setShowJumpToLatest] = useState(false)

  const aiScrollRef = useRef(null)
  const communityScrollRef = useRef(null)
  // 追蹤使用者「在新訊息加入之前」是否停在底部
  const aiAtBottomRef = useRef(true)
  const communityAtBottomRef = useRef(true)

  // 使用者手動捲動時更新「是否在底部」的狀態
  const handleAiScroll = () => {
    aiAtBottomRef.current = isNearBottom(aiScrollRef.current)
  }
  const handleCommunityScroll = () => {
    const atBottom = isNearBottom(communityScrollRef.current)
    communityAtBottomRef.current = atBottom
    // 回到底部時隱藏按鈕
    if (atBottom) setShowJumpToLatest(false)
  }

  // 捲到最新訊息
  const scrollToLatest = useCallback(() => {
    const container = communityScrollRef.current
    if (!container) return
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
    communityAtBottomRef.current = true
    setShowJumpToLatest(false)
  }, [])

  // Auto-scroll AI chat（只捲動聊天容器本身）
  useEffect(() => {
    const container = aiScrollRef.current
    if (activeTab === 'ai' && container && aiAtBottomRef.current) {
      container.scrollTop = container.scrollHeight
    }
  }, [messages, pendingSuggestion, isLoading, activeTab])

  // Auto-scroll community chat（只捲動聊天容器本身）
  useEffect(() => {
    if (activeTab !== 'community') return
    const container = communityScrollRef.current
    if (!container) return

    if (communityAtBottomRef.current) {
      container.scrollTop = container.scrollHeight
      setShowJumpToLatest(false)
    } else {
      // 使用者在上面看歷史訊息，顯示「跳到最新」提示
      setShowJumpToLatest(true)
    }
  }, [communityMessages, activeTab])

  // 切換 tab 時捲到底部
  useEffect(() => {
    if (activeTab === 'ai') {
      aiAtBottomRef.current = true
      const c = aiScrollRef.current
      if (c) c.scrollTop = c.scrollHeight
    } else {
      communityAtBottomRef.current = true
      setShowJumpToLatest(false)
      const c = communityScrollRef.current
      if (c) c.scrollTop = c.scrollHeight
    }
  }, [activeTab])

  // 從社群「詢問 AI 建議」跳轉過來時，自動帶入訊息並送出
  useEffect(() => {
    const prefill = sessionStorage.getItem('ai_chat_prefill')
    const autoSend = sessionStorage.getItem('ai_chat_auto_send')
    const attachmentRaw = sessionStorage.getItem('ai_chat_attachment')
    const prompt = sessionStorage.getItem('ai_chat_prompt')
    if (prefill && autoSend) {
      sessionStorage.removeItem('ai_chat_prefill')
      sessionStorage.removeItem('ai_chat_auto_send')
      sessionStorage.removeItem('ai_chat_attachment')
      sessionStorage.removeItem('ai_chat_prompt')
      setActiveTab('ai')

      // 解析附件（貼文縮圖卡片）
      let attachment = null
      try { attachment = attachmentRaw ? JSON.parse(attachmentRaw) : null } catch { /* ignore */ }

      // 實際送給 AI 的文字（含完整貼文上下文）
      const apiMessage = prompt || prefill

      // 延遲確保 UI 已渲染
      setTimeout(() => {
        // 加入使用者訊息（顯示簡短文字 + 附件卡片）
        setMessages((prev) => [...prev, { role: 'user', content: prefill, attachment }])
        setIsLoading(true)
        sendAiChat(apiMessage, symbol).then((data) => {
          setMessages((prev) => [...prev, { role: 'ai', content: data.message }])
          saveChatHistory(apiMessage, data.message)
          if (data.investment_suggestion) {
            setPendingSuggestion({
              ...data.investment_suggestion,
              originalMessage: apiMessage,
            })
          }
        }).catch(() => {
          setMessages((prev) => [...prev, { role: 'ai', content: '抱歉，目前 AI 無法回應，請稍後再試。' }])
        }).finally(() => {
          setIsLoading(false)
        })
      }, 300)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = async () => {
    if (!input.trim() || isLoading) return
    const userMsg = input.trim()
    setInput('')

    if (activeTab === 'ai') {
      setMessages((prev) => [...prev, { role: 'user', content: userMsg }])
      setIsLoading(true)
      try {
        const data = await sendAiChat(userMsg, symbol)
        setMessages((prev) => [...prev, { role: 'ai', content: data.message }])
        saveChatHistory(userMsg, data.message)
        if (data.investment_suggestion) {
          setPendingSuggestion({
            action: data.investment_suggestion.action,
            currency: data.investment_suggestion.currency,
            amount: data.investment_suggestion.amount,
            reason: data.message,
          })
        }
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          { role: 'system', content: '⚠️ AI 服務暫時無法使用，請稍後再試' },
        ])
      } finally {
        setIsLoading(false)
      }
    } else {
      onSendCommunity?.(userMsg)
      // 自己發言時強制捲到底部
      communityAtBottomRef.current = true
    }
  }

  const [isTrading, setIsTrading] = useState(false)

  const handleConfirmTrade = async () => {
    if (!pendingSuggestion || isTrading) return
    const { action, currency, amount } = pendingSuggestion
    setIsTrading(true)

    try {
      const result = await allowTrade(currency, action, amount)
      if (result.status === 'success') {
        setMessages((prev) => [
          ...prev,
          { role: 'system', content: `✅ ${result.message}（訂單 #${result.trade_id}）` },
        ])
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'system', content: `⚠️ 交易失敗：${result.message}` },
        ])
      }
    } catch (err) {
      const errMsg = err?.message || '交易請求失敗，請稍後再試'
      setMessages((prev) => [
        ...prev,
        { role: 'system', content: `⚠️ ${errMsg}` },
      ])
    } finally {
      setPendingSuggestion(null)
      setIsTrading(false)
    }
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
        <div className="chat-messages" ref={aiScrollRef} onScroll={handleAiScroll}>
          {messages.map((msg, i) => (
            <div key={i} className={`chat-message ${msg.role}`}>
              <div className="message-bubble">
                {msg.role === 'ai'
                  ? (
                    <Markdown
                      className="ai-markdown"
                      remarkPlugins={MARKDOWN_REMARK_PLUGINS}
                      rehypePlugins={MARKDOWN_REHYPE_PLUGINS}
                    >
                      {msg.content}
                    </Markdown>
                  )
                  : msg.content}
              </div>
              {msg.attachment && msg.attachment.type === 'post_card' && (
                <div className="chat-post-card-attach">
                  <div className="attach-header">
                    <span className="attach-tag">📋 社群貼文</span>
                    <span className={`attach-action ${msg.attachment.action}`}>
                      {msg.attachment.action === 'buy' ? '📈 買入' : '📉 賣出'} {msg.attachment.coin}
                    </span>
                  </div>
                  <div className="attach-author">— {msg.attachment.author}</div>
                  <p className="attach-content">「{msg.attachment.content}」</p>
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="chat-message ai">
              <div className="message-bubble loading">AI 思考中...</div>
            </div>
          )}

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
              </div>
              <div className="suggestion-actions">
                <button className="suggestion-btn confirm" onClick={handleConfirmTrade} disabled={isTrading}>
                  {isTrading ? '⏳ 下單中...' : '✓ 確認執行'}
                </button>
                <button className="suggestion-btn reject" onClick={handleRejectTrade} disabled={isTrading}>✕ 取消</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Community Chat tab */}
      {activeTab === 'community' && (
        <div className="community-chat-wrapper">
          <div className="chat-messages community-chat" ref={communityScrollRef} onScroll={handleCommunityScroll}>
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
          </div>

          {/* 跳到最新訊息按鈕（Discord 風格） */}
          {showJumpToLatest && (
            <button className="jump-to-latest" onClick={scrollToLatest}>
              <span className="jump-arrow">↓</span>
              有新訊息
            </button>
          )}
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
        <button className="chat-send-btn" onClick={handleSend} disabled={isLoading}>➤</button>
      </div>
    </div>
  )
}
