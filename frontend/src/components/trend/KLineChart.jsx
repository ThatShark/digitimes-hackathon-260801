import { useEffect, useRef, useImperativeHandle, forwardRef, useMemo } from 'react'
import { createChart, CandlestickSeries } from 'lightweight-charts'

// Generate mock K-line data that spans the full interval
function generateMockData(interval) {
  const data = []
  const now = Math.floor(Date.now() / 1000)

  let candleCount, candleSeconds
  switch (interval) {
    case '1d':
      // 1 day: 24 hourly candles
      candleCount = 24
      candleSeconds = 3600
      break
    case '1Y':
      // 1 year: 52 weekly candles
      candleCount = 52
      candleSeconds = 7 * 86400
      break
    case '1M':
    default:
      // 1 month: 30 daily candles
      candleCount = 30
      candleSeconds = 86400
      break
  }

  let basePrice = 2800000
  // Use a seeded random for stable data per interval
  let seed = interval.charCodeAt(0) * 1000 + candleCount
  const seededRandom = () => {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff
    return (seed >>> 0) / 0xffffffff
  }

  for (let i = candleCount - 1; i >= 0; i--) {
    const time = now - i * candleSeconds
    const open = basePrice + (seededRandom() - 0.5) * 50000
    const close = open + (seededRandom() - 0.5) * 80000
    const high = Math.max(open, close) + seededRandom() * 30000
    const low = Math.min(open, close) - seededRandom() * 30000
    data.push({ time, open, high, low, close })
    basePrice = close
  }
  return data
}

const KLineChart = forwardRef(function KLineChart({ interval, onTimeRangeChange }, ref) {
  const containerRef = useRef(null)
  const chartRef = useRef(null)
  const dataRef = useRef(null)

  const mockData = useMemo(() => generateMockData(interval), [interval])

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    setVisibleRange(from, to) {
      if (chartRef.current) {
        chartRef.current.timeScale().setVisibleRange({ from, to })
      }
    },
    getDataRange() {
      if (!dataRef.current || dataRef.current.length === 0) return null
      return {
        from: dataRef.current[0].time,
        to: dataRef.current[dataRef.current.length - 1].time,
      }
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
      crosshair: {
        mode: 0,
      },
      rightPriceScale: {
        borderColor: '#2e303a',
      },
      timeScale: {
        borderColor: '#2e303a',
        timeVisible: true,
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

    series.setData(mockData)
    dataRef.current = mockData
    chart.timeScale().fitContent()
    chartRef.current = chart

    // Notify parent when visible range changes (user scrolls/zooms the chart)
    chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      if (!onTimeRangeChange) return
      const visibleRange = chart.timeScale().getVisibleRange()
      if (visibleRange && dataRef.current && dataRef.current.length > 0) {
        const dataRange = {
          from: dataRef.current[0].time,
          to: dataRef.current[dataRef.current.length - 1].time,
        }
        onTimeRangeChange(visibleRange, dataRange)
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

    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
      chart.remove()
    }
  }, [mockData, onTimeRangeChange])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
})

export default KLineChart
