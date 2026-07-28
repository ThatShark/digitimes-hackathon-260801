import { useEffect, useRef } from 'react'
import { createChart, CandlestickSeries } from 'lightweight-charts'

// Mock K-line data (30 days of BTC-like data)
function generateMockData() {
  const data = []
  let basePrice = 2800000
  const now = Math.floor(Date.now() / 1000)
  const daySeconds = 86400

  for (let i = 29; i >= 0; i--) {
    const time = now - i * daySeconds
    const open = basePrice + (Math.random() - 0.5) * 50000
    const close = open + (Math.random() - 0.5) * 80000
    const high = Math.max(open, close) + Math.random() * 30000
    const low = Math.min(open, close) - Math.random() * 30000
    data.push({ time, open, high, low, close })
    basePrice = close
  }
  return data
}

export default function KLineChart() {
  const containerRef = useRef(null)
  const chartRef = useRef(null)

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

    series.setData(generateMockData())
    chart.timeScale().fitContent()
    chartRef.current = chart

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
  }, [])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}
