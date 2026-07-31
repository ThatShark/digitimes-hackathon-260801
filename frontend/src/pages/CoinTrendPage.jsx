import { useState, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import KLineChart from '../components/trend/KLineChart'
import ChartControls from '../components/trend/ChartControls'
import DanmakuOverlay from '../components/shared/DanmakuOverlay'
import AIChatPanel from '../components/trend/AIChatPanel'
import IndicatorPanel from '../components/trend/IndicatorPanel'
import TradePanel from '../components/trend/TradePanel'
import './CoinTrendPage.css'

// Interval determines how far back the data goes
const INTERVAL_SECONDS = {
  '1d': 24 * 3600,        // 1 day (24 hours)
  '1M': 30 * 86400,       // 1 month (30 days)
  '1Y': 365 * 86400,      // 1 year
}

export default function CoinTrendPage() {
  const { symbol } = useParams()
  const [interval, setInterval] = useState('1M')
  const [danmakuEnabled, setDanmakuEnabled] = useState(true)
  const [danmakuMessages, setDanmakuMessages] = useState([])
  const [danmakuSettings, setDanmakuSettings] = useState({
    speed: 'normal',
    size: 'medium',
    position: 'top20',
  })

  // Data range timestamps (determined by interval selection)
  const now = useRef(Math.floor(Date.now() / 1000)).current
  const dataTo = now
  const dataFrom = now - (INTERVAL_SECONDS[interval] || INTERVAL_SECONDS['1M'])

  // Visible range as fractions of the data range (0 = dataFrom, 1 = dataTo)
  const [visibleFrom, setVisibleFrom] = useState(0)
  const [visibleTo, setVisibleTo] = useState(1)
  const chartRef = useRef(null)

  // Reset visible range when interval changes
  const handleIntervalChange = useCallback((newInterval) => {
    setInterval(newInterval)
    setVisibleFrom(0)
    setVisibleTo(1)
  }, [])

  const handleSendDanmaku = useCallback((text) => {
    setDanmakuMessages((prev) => [
      ...prev,
      { user: '我', text, id: Date.now() },
    ])
  }, [])

  // Called by chart when user scrolls/zooms — sync progress bar
  const handleTimeRangeChange = useCallback((visibleRange, chartDataRange) => {
    const totalSpan = chartDataRange.to - chartDataRange.from
    if (totalSpan <= 0) return

    const from = (visibleRange.from - chartDataRange.from) / totalSpan
    const to = (visibleRange.to - chartDataRange.from) / totalSpan
    setVisibleFrom(Math.max(0, Math.min(1, from)))
    setVisibleTo(Math.max(0, Math.min(1, to)))
  }, [])

  // Called when user releases the progress bar handles
  const handleRangeCommit = useCallback((fromFraction, toFraction) => {
    setVisibleFrom(fromFraction)
    setVisibleTo(toFraction)

    if (!chartRef.current) return
    const chartDataRange = chartRef.current.getDataRange()
    if (!chartDataRange) return

    const totalSpan = chartDataRange.to - chartDataRange.from
    const from = chartDataRange.from + totalSpan * fromFraction
    const to = chartDataRange.from + totalSpan * toFraction
    chartRef.current.setVisibleRange(from, to)
  }, [])

  return (
    <div className="coin-trend-page">
      {/* Top row: chart + AI panel */}
      <div className="trend-top">
        <div className="trend-chart-area">
          <div className="chart-header">
            <h2 className="chart-title">{symbol}/TWD</h2>
            <span className="chart-interval">{interval}</span>
          </div>
          <div className="chart-container">
            <KLineChart
              ref={chartRef}
              symbol={symbol}
              interval={interval}
              onTimeRangeChange={handleTimeRangeChange}
            />
            <DanmakuOverlay
              enabled={danmakuEnabled}
              messages={danmakuMessages}
              speed={danmakuSettings.speed}
              size={danmakuSettings.size}
              position={danmakuSettings.position}
            />
          </div>
          <ChartControls
            interval={interval}
            onIntervalChange={handleIntervalChange}
            danmakuEnabled={danmakuEnabled}
            onDanmakuToggle={() => setDanmakuEnabled(!danmakuEnabled)}
            onSendDanmaku={handleSendDanmaku}
            danmakuSettings={danmakuSettings}
            onDanmakuSettingsChange={setDanmakuSettings}
            dataFrom={dataFrom}
            dataTo={dataTo}
            visibleFrom={visibleFrom}
            visibleTo={visibleTo}
            onRangeCommit={handleRangeCommit}
          />
        </div>

        <div className="trend-chat-area">
          <AIChatPanel symbol={symbol} />
        </div>
      </div>

      {/* Bottom row: indicators + trade */}
      <div className="trend-bottom">
        <div className="trend-indicators">
          <IndicatorPanel symbol={symbol} />
        </div>
        <div className="trend-trade">
          <TradePanel symbol={symbol} />
        </div>
      </div>
    </div>
  )
}
