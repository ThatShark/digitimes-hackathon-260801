import './ChartControls.css'

const INTERVALS = [
  { value: '1h', label: '時' },
  { value: '1d', label: '日' },
  { value: '1w', label: '周' },
]

export default function ChartControls({
  interval,
  onIntervalChange,
  danmakuEnabled,
  onDanmakuToggle,
}) {
  return (
    <div className="chart-controls">
      <div className="controls-left">
        {/* Progress bar placeholder */}
        <div className="progress-bar">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: '70%' }} />
            <div className="progress-handle" style={{ left: '70%' }} />
          </div>
          <span className="progress-time">2025/07/01</span>
          <span className="progress-time">2025/07/30</span>
        </div>
      </div>

      <div className="controls-right">
        {/* Interval selector */}
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

        {/* Danmaku toggle */}
        <button
          className={`danmaku-toggle ${danmakuEnabled ? 'active' : ''}`}
          onClick={onDanmakuToggle}
          title="彈幕開關"
        >
          彈
        </button>

        {/* Send danmaku */}
        <button className="send-danmaku-btn" title="發送彈幕">
          ✉
        </button>
      </div>
    </div>
  )
}
