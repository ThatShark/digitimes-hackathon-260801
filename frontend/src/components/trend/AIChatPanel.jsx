import { useState } from 'react'
import './AIChatPanel.css'

const MOCK_MESSAGES = [
  { role: 'ai', content: '你好！我是你的 AI 投資助理。有什麼想了解的嗎？' },
]

export default function AIChatPanel({ symbol }) {
  const [messages, setMessages] = useState(MOCK_MESSAGES)
  const [input, setInput] = useState('')

  const handleSend = () => {
    if (!input.trim()) return
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: input },
      { role: 'ai', content: `正在分析 ${symbol} 的市場狀況...（模擬回覆）` },
    ])
    setInput('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="ai-chat-panel">
      <div className="chat-panel-header">
        <span className="chat-tab active">AI 對話</span>
      </div>

      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`chat-message ${msg.role}`}>
            <div className="message-bubble">{msg.content}</div>
          </div>
        ))}
      </div>

      <div className="chat-input-area">
        <input
          type="text"
          className="chat-input"
          placeholder={`詢問關於 ${symbol} 的問題...`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button className="chat-send-btn" onClick={handleSend}>
          ➤
        </button>
      </div>
    </div>
  )
}
