import { useState } from 'react'
import ProgressBar from './ProgressBar'
import './ChartControls.css'

const INTERVALS = [
  { value: '15m', label: '15分' },
  { value: '1h', label: '1時' },
  { value: '4h', label: '4時' },
  { value: '1D', label: '1日' },
  { value: '1W', label: '1周' },
  { value: '1M', label: '1月' },
]

export default function ChartControls({
  interval,
  onIntervalChange,
  onSendMessage,
  danmakuEnabled,
  onDanmakuToggle,
  // Progress bar props
  dataFrom,
  dataTo,
  visibleFrom,
  visibleTo,
  onRangeCommit,
}) {
  const [messageInput, setMessageInput] = useState('')
  const [showInput, setShowInput] = useState(false)

  const handleSend = () => {
    if (!messageInput.trim()) return
    onSendMessage?.(messageInput.trim())
    setMessageInput('')
    setShowInput(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSend()
    }
    if (e.key === 'Escape') {
      setShowInput(false)
      setMessageInput('')
    }
  }

  return (
    <div className="chart-controls">
      <div className="controls-left">
        {showInput ? (
          <div className="danmaku-input-row">
            <input
              type="text"
              className="danmaku-input"
              placeholder="發送訊息..."
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              maxLength={50}
            />
            <button className="danmaku-send-confirm" onClick={handleSend}>
              送出
            </button>
            <button
              className="danmaku-send-cancel"
              onClick={() => { setShowInput(false); setMessageInput('') }}
            >
              ✕
            </button>
          </div>
        ) : (
          <ProgressBar
            dataFrom={dataFrom}
            dataTo={dataTo}
            visibleFrom={visibleFrom}
            visibleTo={visibleTo}
            onRangeCommit={onRangeCommit}
          />
        )}
      </div>

      <div className="controls-right">
        <div className="interval-group">
          {INTERVALS.map((opt) => (
            <button
              key={opt.value}
              className={`interval-btn ${interval === opt.value ? 'active' : ''}`}
              onClick={() => onIntervalChange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <button
          className={`danmaku-toggle ${danmakuEnabled ? 'active' : ''}`}
          onClick={onDanmakuToggle}
          title={danmakuEnabled ? '關閉彈幕' : '開啟彈幕'}
        >
          彈
        </button>

        <button
          className="send-danmaku-btn"
          title="發送訊息"
          onClick={() => setShowInput(!showInput)}
        >
          ✉
        </button>
      </div>
    </div>
  )
}
