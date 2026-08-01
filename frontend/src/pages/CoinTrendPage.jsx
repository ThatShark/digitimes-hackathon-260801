import { useState, useCallback, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { pickRandomMockMessage, ME_USER } from '../utils/mockChat'
import { fetchLivePriceInfo } from '../services/coinApi'
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
import CoinSocialFeed from '../components/trend/CoinSocialFeed'
import BookmarkButton from '../components/shared/BookmarkButton'
import './CoinTrendPage.css'

// 後端請求失敗時的 fallback 假資料（與 MainPage 的 FALLBACK_PRICES 對齊）
const FALLBACK_PRICES = {
  BTC: { price: 2850000, change: 2.3 },
  ETH: { price: 98500, change: -1.2 },
  SOL: { price: 5420, change: 5.7 },
  DOGE: { price: 8.2, change: 0.4 },
  ADA: { price: 21.5, change: -0.8 },
  DOT: { price: 245, change: 3.1 },
  PEPE: { price: 0.032, change: 15.2 },
  WIF: { price: 12.8, change: 8.9 },
  ARB: { price: 38.5, change: 4.2 },
}

const MARKET_DATA_TABS = [
  { key: 'depth', label: '深度圖' },
  { key: 'trades', label: '最新成交' },
  { key: 'events', label: '關鍵事件' },
]

function MarketDataTabs({ symbol }) {
  const [activeTab, setActiveTab] = useState('depth')
  return (
    <div className="market-data-panel">
      <div className="market-data-tab-bar">
        {MARKET_DATA_TABS.map((tab) => (
          <button
            key={tab.key}
            className={`md-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="market-data-content">
        {activeTab === 'depth' && <DepthChart symbol={symbol} />}
        {activeTab === 'trades' && <RecentTrades symbol={symbol} />}
        {activeTab === 'events' && <KeyEvents symbol={symbol} />}
      </div>
    </div>
  )
}

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
  // price/change 為 null 時代表尚未取得資料，畫面顯示「載入中」（跟主頁幣種卡片一致）
  const [priceInfo, setPriceInfo] = useState({ price: null, change: null })
  const [danmakuEnabled, setDanmakuEnabled] = useState(true)
  const [danmakuMessages, setDanmakuMessages] = useState([])
  // 聊天室訊息（與彈幕共用同一份來源）
  const [communityMessages, setCommunityMessages] = useState([])
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
  // Actual timestamps of the visible range (for indicator sync)
  const [visibleTimeRange, setVisibleTimeRange] = useState(null)
  const chartRef = useRef(null)

  const handleIntervalChange = useCallback((newInterval) => {
    setInterval(newInterval)
    setVisibleFrom(0)
    setVisibleTo(1)
  }, [])

  // 進入頁面 / 切換幣種時，向後端要求該幣種的即時價格。
  // 拿到之前顯示「載入中」；最終失敗才 fallback 回假資料，避免卡住。
  useEffect(() => {
    let cancelled = false
    setPriceInfo({ price: null, change: null }) // 切換幣種時先回到載入中狀態

    fetchLivePriceInfo(symbol).then((live) => {
      if (cancelled) return
      if (live) {
        setPriceInfo(live)
      } else {
        const fallback = FALLBACK_PRICES[symbol]
        setPriceInfo(fallback || { price: null, change: null })
      }
    })

    return () => { cancelled = true }
  }, [symbol])

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

  const handleFullscreen = useCallback(() => {
    const el = document.querySelector('.trend-chart-area')
    if (!el) return
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      el.requestFullscreen?.()
    }
  }, [])

  // 模擬其他使用者發言（唯一的假資料來源）
  useEffect(() => {
    const timer = window.setInterval(() => {
      const { user, text } = pickRandomMockMessage()
      addCommunityMessage(user, text)
    }, 3000)
    return () => clearInterval(timer)
  }, [addCommunityMessage])

  const handleTimeRangeChange = useCallback((visibleRange, chartDataRange) => {
    const totalSpan = chartDataRange.to - chartDataRange.from
    if (totalSpan <= 0) return
    const from = (visibleRange.from - chartDataRange.from) / totalSpan
    const to = (visibleRange.to - chartDataRange.from) / totalSpan
    setVisibleFrom(Math.max(0, Math.min(1, from)))
    setVisibleTo(Math.max(0, Math.min(1, to)))
    setVisibleTimeRange({ from: visibleRange.from, to: visibleRange.to })
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
          {priceInfo.price === null || priceInfo.price === undefined ? (
            <span className="coin-page-price loading">載入中...</span>
          ) : (
            (() => {
              const isUp = priceInfo.change >= 0
              return (
                <span className={`coin-page-price ${isUp ? 'up' : 'down'}`}>
                  NT$ {priceInfo.price.toLocaleString()}
                  <span className="coin-page-change">
                    {isUp ? '+' : ''}{priceInfo.change}%
                  </span>
                </span>
              )
            })()
          )}
          <div className="coin-page-actions">
            <BookmarkButton symbol={symbol} />
            <ShareButton symbol={symbol} />
          </div>
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
                <button
                  className="chart-fullscreen-btn"
                  onClick={handleFullscreen}
                  title="全螢幕"
                >
                  ⛶
                </button>
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
          <div className="trend-bottom">
            <div className="trend-indicators">
              <IndicatorPanel symbol={symbol} chartRef={chartRef} visibleTimeRange={visibleTimeRange} />
            </div>
            <div className="trend-trade">
              <TradePanel symbol={symbol} />
            </div>
          </div>
          <div className="trend-market-data">
            <MarketDataTabs symbol={symbol} />
          </div>
        </>
      )}

      {/* 概況 tab */}
      {activeTab === 'overview' && <CoinOverview symbol={symbol} />}

      {/* 數據 tab */}
      {activeTab === 'data' && <FundFlowChart symbol={symbol} />}

      {/* 動態 tab */}
      {activeTab === 'social' && (
        <CoinSocialFeed symbol={symbol} />
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
