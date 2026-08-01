import { useState, useRef, useEffect } from 'react'
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
  danmakuEnabled,
  onDanmakuToggle,
  danmakuSettings,
  onDanmakuSettingsChange,
  // Progress bar props
  dataFrom,
  dataTo,
  visibleFrom,
  visibleTo,
  onRangeCommit,
}) {
  const [showSettings, setShowSettings] = useState(false)
  const settingsRef = useRef(null)

  // Close settings popover on outside click
  useEffect(() => {
    if (!showSettings) return
    const handleClick = (e) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) {
        setShowSettings(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showSettings])

  return (
    <div className="chart-controls">
      <div className="controls-left">
        <ProgressBar
          dataFrom={dataFrom}
          dataTo={dataTo}
          visibleFrom={visibleFrom}
          visibleTo={visibleTo}
          onRangeCommit={onRangeCommit}
        />
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

        <div className="danmaku-settings-wrapper" ref={settingsRef}>
          <button
            className={`danmaku-settings-btn ${showSettings ? 'active' : ''}`}
            title="彈幕設定"
            onClick={() => setShowSettings(!showSettings)}
          >
            ⚙
          </button>

          {showSettings && (
            <div className="danmaku-settings-popover">
              <div className="settings-title">彈幕設定</div>

              <div className="settings-group">
                <label className="settings-label">速度</label>
                <div className="settings-options">
                  {[
                    { value: 'slow', label: '慢' },
                    { value: 'normal', label: '中' },
                    { value: 'fast', label: '快' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      className={`settings-option ${danmakuSettings.speed === opt.value ? 'active' : ''}`}
                      onClick={() => onDanmakuSettingsChange({ ...danmakuSettings, speed: opt.value })}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="settings-group">
                <label className="settings-label">大小</label>
                <div className="settings-options">
                  {[
                    { value: 'small', label: '小' },
                    { value: 'medium', label: '中' },
                    { value: 'large', label: '大' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      className={`settings-option ${danmakuSettings.size === opt.value ? 'active' : ''}`}
                      onClick={() => onDanmakuSettingsChange({ ...danmakuSettings, size: opt.value })}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="settings-group">
                <label className="settings-label">顯示位置</label>
                <div className="settings-options">
                  {[
                    { value: 'top20', label: '上20%' },
                    { value: 'top40', label: '上40%' },
                    { value: 'full', label: '全部' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      className={`settings-option ${danmakuSettings.position === opt.value ? 'active' : ''}`}
                      onClick={() => onDanmakuSettingsChange({ ...danmakuSettings, position: opt.value })}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
