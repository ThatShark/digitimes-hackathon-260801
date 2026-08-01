import { useEffect, useRef, useImperativeHandle, forwardRef, useMemo } from 'react'
import { createChart, CandlestickSeries } from 'lightweight-charts'
import { getCandlestickChart, getCoinPrice } from '../../services/coinApi'
import { isBackendConfigured } from '../../services/api'

// 幣種上市日期（Unix timestamp 秒）
const COIN_LAUNCH_DATES = {
  BTC: 1230940800,   // 2009-01-03
  ETH: 1438214400,   // 2015-07-30
  SOL: 1584316800,   // 2020-03-16
  DOGE: 1386374400,  // 2013-12-07
  ADA: 1506816000,   // 2017-10-01
  DOT: 1597968000,   // 2020-08-21
  PEPE: 1681344000,  // 2023-04-13
  WIF: 1701388800,   // 2023-12-01
  ARB: 1679529600,   // 2023-03-23
}

// 每根 K 棒的秒數
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

// 基準價格
const BASE_PRICES = {
  BTC: 2850000, ETH: 98500, SOL: 5420, DOGE: 8.2, ADA: 21.5, DOT: 245,
  PEPE: 0.032, WIF: 12.8, ARB: 38.5,
}

/**
 * 生成從上市日期到現在的 mock K 線資料
 * 無論何種週期，第一根 K 棒的 time 都是該幣的上市日期
 */
function generateMockData(interval, symbol) {
  const seconds = INTERVAL_SECONDS[interval] || 86400
  const now = Math.floor(Date.now() / 1000)
  const launchDate = COIN_LAUNCH_DATES[symbol] || now - 365 * 86400

  // 計算從上市到現在總共有幾根 K 棒
  const totalSpan = now - launchDate
  const totalCandles = Math.floor(totalSpan / seconds)

  // 限制最大 K 棒數量避免效能問題，但保留第一根一定是上市日期
  const maxCandles = 2000
  const candleCount = Math.min(totalCandles, maxCandles)

  // 起始時間：如果超過 maxCandles，從 now - maxCandles * seconds 開始
  // 否則從上市日期開始
  const startTime = candleCount === totalCandles ? launchDate : now - candleCount * seconds

  let basePrice = BASE_PRICES[symbol] || 2850000
  // 如果從很早期開始，起始價格要低，模擬成長
  const currentPrice = BASE_PRICES[symbol] || 2850000
  if (candleCount === totalCandles && totalCandles > 50) {
    // 從上市價開始（假設是當前價的 0.01~5%）
    basePrice = currentPrice * 0.005
  } else if (candleCount > 200) {
    basePrice = currentPrice * 0.4
  }

  // 計算每根 K 棒的平均漲幅以在最後逼近當前價
  const targetGrowth = currentPrice / basePrice
  const growthPerCandle = Math.pow(targetGrowth, 1 / candleCount)

  let seed = (symbol || 'BTC').charCodeAt(0) * 1000 + candleCount + seconds
  const seededRandom = () => {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff
    return (seed >>> 0) / 0xffffffff
  }

  const data = []
  for (let i = 0; i < candleCount; i++) {
    const time = startTime + i * seconds
    const volatility = basePrice * 0.02
    const trendBias = basePrice * (growthPerCandle - 1) // 趨勢偏移
    const open = basePrice
    const close = open * growthPerCandle + (seededRandom() - 0.5) * volatility
    const high = Math.max(open, close) + seededRandom() * volatility * 0.4
    const low = Math.min(open, close) - seededRandom() * volatility * 0.4
    data.push({ time, open, high, low, close })
    basePrice = close
  }
  return data
}

/**
 * 即時 tick：更新最新 K 棒或產生新 K 棒
 */
function generateRealtimeTick(lastCandle, intervalSeconds) {
  const now = Math.floor(Date.now() / 1000)
  if (now - lastCandle.time >= intervalSeconds) {
    // 新 K 棒
    const newTime = lastCandle.time + intervalSeconds
    const open = lastCandle.close
    const change = (Math.random() - 0.48) * open * 0.003
    const close = open + change
    const high = Math.max(open, close) + Math.random() * Math.abs(change) * 0.3
    const low = Math.min(open, close) - Math.random() * Math.abs(change) * 0.3
    return { time: newTime, open, high, low, close, isNew: true }
  }
  // 更新當前 K 棒
  const change = (Math.random() - 0.48) * lastCandle.close * 0.001
  const close = lastCandle.close + change
  return {
    time: lastCandle.time,
    open: lastCandle.open,
    high: Math.max(lastCandle.high, close),
    low: Math.min(lastCandle.low, close),
    close,
    isNew: false,
  }
}

const KLineChart = forwardRef(function KLineChart({ symbol, interval, onTimeRangeChange }, ref) {
  const containerRef = useRef(null)
  const chartInstanceRef = useRef(null)
  const seriesRef = useRef(null)
  const dataRef = useRef(null)
  const tickTimerRef = useRef(null)

  const seconds = INTERVAL_SECONDS[interval] || 86400
  const mockData = useMemo(() => generateMockData(interval, symbol), [interval, symbol])

  useImperativeHandle(ref, () => ({
    setVisibleRange(from, to) {
      chartInstanceRef.current?.timeScale().setVisibleRange({ from, to })
    },
    getDataRange() {
      if (!dataRef.current || dataRef.current.length === 0) return null
      return {
        from: dataRef.current[0].time,
        to: dataRef.current[dataRef.current.length - 1].time,
      }
    },
    getData() {
      return dataRef.current || []
    },
  }))

  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: 'solid', color: 'transparent' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: '#2e303a' },
        horzLines: { color: '#2e303a' },
      },
      crosshair: { mode: 0 },
      rightPriceScale: { borderColor: '#2e303a' },
      timeScale: {
        borderColor: '#2e303a',
        timeVisible: seconds < 86400, // 日線以下顯示時間
        rightOffset: 3,
      },
    })

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#34d399',
      downColor: '#f87171',
      borderUpColor: '#34d399',
      borderDownColor: '#f87171',
      wickUpColor: '#34d399',
      wickDownColor: '#f87171',
    })

    chartInstanceRef.current = chart
    seriesRef.current = series

    // 載入資料
    let usingRealData = false
    const loadData = async () => {
      let chartData = null
      if (isBackendConfigured()) {
        try {
          const now = Math.floor(Date.now() / 1000)
          // Calculate a sensible lookback window based on interval
          // to avoid requesting too many candles
          const INTERVAL_LOOKBACK = {
            '15m': 3 * 86400,       // 3 days of 15m candles
            '1h': 14 * 86400,       // 14 days of hourly candles
            '4h': 30 * 86400,       // 30 days of 4h candles
            '1D': 365 * 86400,      // 1 year of daily candles
            '1W': 2 * 365 * 86400,  // 2 years of weekly candles
            '1M': 30 * 86400,       // 30 days of daily candles
          }
          const lookback = INTERVAL_LOOKBACK[interval] || 30 * 86400
          const start = now - lookback
          const res = await getCandlestickChart(symbol, start, now, interval)
          if (res?.candles && Array.isArray(res.candles) && res.candles.length > 0) {
            chartData = res.candles
            usingRealData = true
          }
        } catch { /* fallback */ }
      }
      chartData = chartData || mockData
      series.setData(chartData)
      dataRef.current = [...chartData]
      // 預設顯示最近的部分
      chart.timeScale().scrollToRealTime()
    }
    loadData()

    // 即時更新（每 2 秒）— 使用真實價格或模擬 tick
    tickTimerRef.current = window.setInterval(async () => {
      if (!dataRef.current || dataRef.current.length === 0) return
      const last = dataRef.current[dataRef.current.length - 1]

      if (usingRealData && isBackendConfigured()) {
        // Fetch real latest price and update the current candle
        try {
          const priceRes = await getCoinPrice(symbol)
          if (priceRes?.last != null) {
            const now = Math.floor(Date.now() / 1000)
            const price = priceRes.last
            // Check if we need a new candle or update the existing one
            if (now - last.time >= seconds) {
              // New candle period started
              const newCandle = {
                time: last.time + seconds,
                open: price,
                high: price,
                low: price,
                close: price,
              }
              dataRef.current.push(newCandle)
              series.update(newCandle)
            } else {
              // Update current candle with latest price
              const updated = {
                ...last,
                high: Math.max(last.high, price),
                low: Math.min(last.low, price),
                close: price,
              }
              dataRef.current[dataRef.current.length - 1] = updated
              series.update(updated)
            }
          }
        } catch { /* ignore fetch errors for real-time updates */ }
      } else {
        // Mock tick for demo mode
        const tick = generateRealtimeTick(last, seconds)
        const candle = { time: tick.time, open: tick.open, high: tick.high, low: tick.low, close: tick.close }
        if (tick.isNew) {
          dataRef.current.push(candle)
        } else {
          dataRef.current[dataRef.current.length - 1] = candle
        }
        series.update(candle)
      }
    }, 2000)

    // 監聽可視範圍
    chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      if (!onTimeRangeChange) return
      const visibleRange = chart.timeScale().getVisibleRange()
      if (visibleRange && dataRef.current && dataRef.current.length > 0) {
        onTimeRangeChange(visibleRange, {
          from: dataRef.current[0].time,
          to: dataRef.current[dataRef.current.length - 1].time,
        })
      }
    })

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        })
      }
    }
    const ro = new ResizeObserver(handleResize)
    ro.observe(containerRef.current)

    return () => {
      if (tickTimerRef.current) clearInterval(tickTimerRef.current)
      ro.disconnect()
      chart.remove()
    }
  }, [mockData, seconds, symbol, interval, onTimeRangeChange])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
})

export default KLineChart
