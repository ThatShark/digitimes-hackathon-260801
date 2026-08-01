import { useState, useCallback, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { pickRandomMockMessage, ME_USER } from '../utils/mockChat'
import KLineChart from '../components/trend/KLineChart'
import ChartControls from '../components/trend/ChartControls'
import DanmakuOverlay from '../components/shared/DanmakuOverlay'
import AIChatPanel from '../components/trend/AIChatPanel'
import IndicatorPanel from '../components/trend/IndicatorPanel'
import TradePanel from '../components/trend/TradePanel'
import DepthChart from '../components/trend/DepthChart'
import RecentTrades from '../components/trend/RecentTrades'
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
  // 聊天室訊息（與彈幕共用同一份來源）
  const [communityMessages, setCommunityMessages] = useState([])
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
  // Actual timestamps of the visible range (for indicator sync)
  const [visibleTimeRange, setVisibleTimeRange] = useState(null)
  const chartRef = useRef(null)

  // Reset visible range when interval changes
  const handleIntervalChange = useCallback((newInterval) => {
    setInterval(newInterval)
    setVisibleFrom(0)
    setVisibleTo(1)
  }, [])

  /**
   * 單一入口：新增一則社群訊息。
   * 同時寫入聊天室清單與彈幕 overlay，確保兩邊內容一致。
   */
  const addCommunityMessage = useCallback((user, text, isMe = false) => {
    const id = `${Date.now()}-${Math.random()}`
    const msg = {
      id,
      user,
      text,
      time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
      isMe,
    }
    setCommunityMessages((prev) => [...prev.slice(-80), msg])
    setDanmakuMessages((prev) => [...prev.slice(-40), { user: user.name, text, id }])
  }, [])

  // K 線圖控制列的「發送彈幕」也走同一個入口
  const handleSendDanmaku = useCallback((text) => {
    addCommunityMessage(ME_USER, text, true)
  }, [addCommunityMessage])

  // 模擬其他使用者發言（唯一的假資料來源）
  useEffect(() => {
    const timer = window.setInterval(() => {
      const { user, text } = pickRandomMockMessage()
      addCommunityMessage(user, text)
    }, 3000)
    return () => clearInterval(timer)
  }, [addCommunityMessage])

  // Called by chart when user scrolls/zooms — sync progress bar
  const handleTimeRangeChange = useCallback((visibleRange, chartDataRange) => {
    const totalSpan = chartDataRange.to - chartDataRange.from
    if (totalSpan <= 0) return

    const from = (visibleRange.from - chartDataRange.from) / totalSpan
    const to = (visibleRange.to - chartDataRange.from) / totalSpan
    setVisibleFrom(Math.max(0, Math.min(1, from)))
    setVisibleTo(Math.max(0, Math.min(1, to)))
    setVisibleTimeRange({ from: visibleRange.from, to: visibleRange.to })
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
          <AIChatPanel
            symbol={symbol}
            communityMessages={communityMessages}
            onSendCommunity={(text) => addCommunityMessage(ME_USER, text, true)}
          />
        </div>
      </div>

      {/* Bottom row: indicators + trade */}
      <div className="trend-bottom">
        <div className="trend-indicators">
          <IndicatorPanel symbol={symbol} chartRef={chartRef} visibleTimeRange={visibleTimeRange} />
        </div>
        <div className="trend-trade">
          <TradePanel symbol={symbol} />
        </div>
      </div>

      {/* Depth + Recent Trades */}
      <div className="trend-market-data">
        <DepthChart symbol={symbol} />
        <RecentTrades symbol={symbol} />
      </div>
    </div>
  )
}
