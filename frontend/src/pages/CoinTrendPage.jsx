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

function MarketDataTabs({ symbol, currency }) {
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
        {activeTab === 'depth' && <DepthChart symbol={symbol} currency={currency} />}
        {activeTab === 'trades' && <RecentTrades symbol={symbol} currency={currency} />}
        {activeTab === 'events' && <KeyEvents symbol={symbol} />}
      </div>
    </div>
  )
}

const INTERVAL_SECONDS = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '30m': 1800,
  '1h': 3600,
  '4h': 14400,
  '1D': 86400,
  '1W': 604800,
  '1M': 259200,    // 月視圖使用 3 日 K（每根 = 3 天）
}

const TABS = [
  { key: 'chart', label: '行情' },
  { key: 'overview', label: '概況' },
  { key: 'data', label: '數據' },
  { key: 'social', label: '動態' },
  { key: 'strategy', label: '策略' },
]

export default function CoinTrendPage() {
  const { symbol } = useParams()
  const [activeTab, setActiveTab] = useState('chart')
  const [interval, setInterval] = useState('15m')
  // price/change 為 null 時代表尚未取得資料，畫面顯示「載入中」（跟主頁幣種卡片一致）
  const [priceInfo, setPriceInfo] = useState({ price: null, change: null })
  const [currency, setCurrency] = useState('TWD') // 'TWD' | 'USD'
  const [danmakuEnabled, setDanmakuEnabled] = useState(true)
  const [danmakuSettings, setDanmakuSettings] = useState({
    speed: 'normal',
    size: 'medium',
    position: 'top20',
  })
  // 聊天室訊息
  const [communityMessages, setCommunityMessages] = useState([])

  const now = useRef(Math.floor(Date.now() / 1000)).current
  const dataTo = now
  const dataFrom = now - (INTERVAL_SECONDS[interval] || INTERVAL_SECONDS['1D'])
  const [visibleFrom, setVisibleFrom] = useState(0)
  const [visibleTo, setVisibleTo] = useState(1)
  const [visibleTimeRange, setVisibleTimeRange] = useState(null)
  const chartRef = useRef(null)
  const danmakuRef = useRef(null)
  // 彈幕是否就緒（切 tab 或開關彈幕後延遲 0.5s）
  const danmakuReadyRef = useRef(true)

  // 彈幕顯示條件：行情 tab + 彈幕開啟
  const danmakuVisible = activeTab === 'chart' && danmakuEnabled

  // 當彈幕從不可見變為可見時，設定 0.5s 靜默期
  const prevVisibleRef = useRef(danmakuVisible)
  useEffect(() => {
    if (danmakuVisible && !prevVisibleRef.current) {
      // 剛變為可見，啟動靜默期
      danmakuReadyRef.current = false
      const timer = setTimeout(() => { danmakuReadyRef.current = true }, 500)
      prevVisibleRef.current = true
      return () => clearTimeout(timer)
    }
    if (!danmakuVisible) {
      prevVisibleRef.current = false
      danmakuReadyRef.current = false
    }
  }, [danmakuVisible])

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

    const fetchPrice = () => {
      fetchLivePriceInfo(symbol).then((live) => {
        if (cancelled) return
        if (live) {
          setPriceInfo(live)
        } else {
          const fallback = FALLBACK_PRICES[symbol]
          setPriceInfo(fallback || { price: null, change: null })
        }
      })
    }

    fetchPrice()
    const timer = window.setInterval(fetchPrice, 2000)

    return () => { cancelled = true; clearInterval(timer) }
  }, [symbol])

  /**
   * 單一入口：新增一則社群訊息到聊天室。
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
    // 只有彈幕就緒 + 頁面可見時才飄動，自己發的優先顯示
    if (danmakuReadyRef.current && document.visibilityState === 'visible') {
      danmakuRef.current?.addBullet(user.name, text, isMe)
    }
  }, [])

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
          <h1 className="coin-page-title">{symbol}/{currency}</h1>
          {priceInfo.price === null || priceInfo.price === undefined ? (
            <span className="coin-page-price loading">載入中...</span>
          ) : (
            (() => {
              const TWD_USD_RATE = 32.5
              const isUp = priceInfo.change >= 0
              const displayPrice = currency === 'TWD'
                ? priceInfo.price
                : priceInfo.price / TWD_USD_RATE
              const prefix = currency === 'TWD' ? 'NT$' : '$'
              return (
                <span className={`coin-page-price ${isUp ? 'up' : 'down'}`}>
                  {prefix} {displayPrice.toLocaleString(undefined, { maximumFractionDigits: currency === 'USD' ? 2 : 0 })}
                  <span className="coin-page-change">
                    {isUp ? '+' : ''}{priceInfo.change}%
                  </span>
                </span>
              )
            })()
          )}
          <button
            className="currency-toggle"
            onClick={() => setCurrency((c) => c === 'TWD' ? 'USD' : 'TWD')}
            title="切換幣值單位"
          >
            {currency === 'TWD' ? '🇹🇼 TWD' : '🇺🇸 USD'}
          </button>
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
                  currency={currency}
                  onTimeRangeChange={handleTimeRangeChange}
                />
                {danmakuVisible && (
                  <DanmakuOverlay
                    ref={danmakuRef}
                    speed={danmakuSettings.speed}
                    size={danmakuSettings.size}
                    position={danmakuSettings.position}
                  />
                )}
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
                onDanmakuToggle={() => setDanmakuEnabled((v) => !v)}
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
              <IndicatorPanel symbol={symbol} currency={currency} chartRef={chartRef} visibleTimeRange={visibleTimeRange} />
            </div>
            <div className="trend-trade">
              <TradePanel symbol={symbol} currency={currency} />
            </div>
          </div>
          <div className="trend-market-data">
            <MarketDataTabs symbol={symbol} currency={currency} />
          </div>
        </>
      )}

      {/* 概況 tab */}
      {activeTab === 'overview' && <CoinOverview symbol={symbol} currency={currency} />}

      {/* 數據 tab */}
      {activeTab === 'data' && <FundFlowChart symbol={symbol} />}

      {/* 動態 tab */}
      {activeTab === 'social' && (
        <CoinSocialFeed symbol={symbol} />
      )}

      {/* 策略 tab */}
      {activeTab === 'strategy' && <StrategyHub symbol={symbol} currency={currency} />}
    </div>
  )
}
