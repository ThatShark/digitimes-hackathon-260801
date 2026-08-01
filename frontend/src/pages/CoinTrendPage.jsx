import { useState, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import KLineChart from '../components/trend/KLineChart'
import ChartControls from '../components/trend/ChartControls'
import DanmakuOverlay from '../components/shared/DanmakuOverlay'
import AIChatPanel from '../components/trend/AIChatPanel'
import IndicatorPanel from '../components/trend/IndicatorPanel'
import TradePanel from '../components/trend/TradePanel'
import DepthChart from '../components/trend/DepthChart'
import RecentTrades from '../components/trend/RecentTrades'
import CoinOverview from '../components/trend/CoinOverview'
import FundFlowChart from '../components/trend/FundFlowChart'
import StrategyHub from '../components/trend/StrategyHub'
import KeyEvents from '../components/trend/KeyEvents'
import ShareButton from '../components/trend/ShareButton'
import './CoinTrendPage.css'

const INTERVAL_SECONDS = {
  '1d': 24 * 3600,
  '1M': 30 * 86400,
  '1Y': 365 * 86400,
}

const TABS = [
  { key: 'chart', label: '行情' },
  { key: 'overview', label: '概況' },
  { key: 'data', label: '數據' },
  { key: 'social', label: '動態' },
  { key: 'trade', label: '交易' },
  { key: 'strategy', label: '策略' },
]

export default function CoinTrendPage() {
  const { symbol } = useParams()
  const [activeTab, setActiveTab] = useState('chart')
  const [interval, setInterval] = useState('1M')
  const [danmakuEnabled, setDanmakuEnabled] = useState(true)
  const [danmakuMessages, setDanmakuMessages] = useState([])
  const [danmakuSettings, setDanmakuSettings] = useState({
    speed: 'normal',
    size: 'medium',
    position: 'top20',
  })

  const now = useRef(Math.floor(Date.now() / 1000)).current
  const dataTo = now
  const dataFrom = now - (INTERVAL_SECONDS[interval] || INTERVAL_SECONDS['1M'])
  const [visibleFrom, setVisibleFrom] = useState(0)
  const [visibleTo, setVisibleTo] = useState(1)
  const chartRef = useRef(null)

  const handleIntervalChange = useCallback((newInterval) => {
    setInterval(newInterval)
    setVisibleFrom(0)
    setVisibleTo(1)
  }, [])

  const handleSendDanmaku = useCallback((text) => {
    setDanmakuMessages((prev) => [...prev, { user: '我', text, id: Date.now() }])
  }, [])

  const handleCommunityDanmaku = useCallback((msg) => {
    setDanmakuMessages((prev) => [...prev, { user: msg.user, text: msg.text, id: msg.id }])
  }, [])

  const handleTimeRangeChange = useCallback((visibleRange, chartDataRange) => {
    const totalSpan = chartDataRange.to - chartDataRange.from
    if (totalSpan <= 0) return
    const from = (visibleRange.from - chartDataRange.from) / totalSpan
    const to = (visibleRange.to - chartDataRange.from) / totalSpan
    setVisibleFrom(Math.max(0, Math.min(1, from)))
    setVisibleTo(Math.max(0, Math.min(1, to)))
  }, [])

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
      {/* Header with tabs */}
      <div className="coin-page-header">
        <div className="coin-page-title-row">
          <h1 className="coin-page-title">{symbol}/TWD</h1>
          <ShareButton symbol={symbol} />
        </div>
        <nav className="coin-page-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={`coin-tab ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* 行情 tab */}
      {activeTab === 'chart' && (
        <>
          <div className="trend-top">
            <div className="trend-chart-area">
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
              <AIChatPanel symbol={symbol} onDanmaku={handleCommunityDanmaku} />
            </div>
          </div>
          <div className="trend-bottom">
            <div className="trend-indicators">
              <IndicatorPanel symbol={symbol} />
            </div>
            <div className="trend-trade">
              <TradePanel symbol={symbol} />
            </div>
          </div>
          <div className="trend-market-data">
            <DepthChart symbol={symbol} />
            <RecentTrades symbol={symbol} />
          </div>
          <KeyEvents symbol={symbol} />
        </>
      )}

      {/* 概況 tab */}
      {activeTab === 'overview' && <CoinOverview symbol={symbol} />}

      {/* 數據 tab */}
      {activeTab === 'data' && <FundFlowChart symbol={symbol} />}

      {/* 動態 tab */}
      {activeTab === 'social' && (
        <div className="trend-chat-area full-width">
          <AIChatPanel symbol={symbol} onDanmaku={handleCommunityDanmaku} />
        </div>
      )}

      {/* 交易 tab */}
      {activeTab === 'trade' && (
        <div className="trade-tab-layout">
          <div className="trade-tab-panel">
            <TradePanel symbol={symbol} />
          </div>
          <div className="trade-tab-depth">
            <DepthChart symbol={symbol} />
          </div>
        </div>
      )}

      {/* 策略 tab */}
      {activeTab === 'strategy' && <StrategyHub symbol={symbol} />}
    </div>
  )
}
