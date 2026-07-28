import './IndicatorPanel.css'

export default function IndicatorPanel() {
  return (
    <div className="indicator-panel">
      <div className="indicator-header">
        <span className="indicator-title">分析指標</span>
        <div className="indicator-tags">
          <span className="indicator-tag active">MACD</span>
          <span className="indicator-tag">RSI</span>
          <span className="indicator-tag">MA</span>
          <span className="indicator-tag">VOL</span>
        </div>
      </div>
      <div className="indicator-content">
        {/* Placeholder chart area for indicators */}
        <div className="indicator-placeholder">
          <div className="placeholder-bar" style={{ height: '60%' }} />
          <div className="placeholder-bar" style={{ height: '40%' }} />
          <div className="placeholder-bar" style={{ height: '80%' }} />
          <div className="placeholder-bar" style={{ height: '30%' }} />
          <div className="placeholder-bar" style={{ height: '55%' }} />
          <div className="placeholder-bar" style={{ height: '70%' }} />
          <div className="placeholder-bar" style={{ height: '45%' }} />
          <div className="placeholder-bar" style={{ height: '65%' }} />
        </div>
      </div>
    </div>
  )
}
