import { useState, useEffect, useRef } from 'react'
import { createChart, LineSeries, HistogramSeries } from 'lightweight-charts'
import {
  calcMA, calcEMA, calcMACD, calcBOLL,
  calcRSI, calcKDJ, calcSTOCH,
  calcVOL, calcOBV, calcATR,
} from '../../utils/indicators'
import './IndicatorPanel.css'

const INDICATORS = [
  { id: 'MACD', label: 'MACD', category: 'trend' },
  { id: 'RSI', label: 'RSI', category: 'momentum' },
  { id: 'MA', label: 'MA', category: 'trend' },
  { id: 'EMA', label: 'EMA', category: 'trend' },
  { id: 'BOLL', label: 'BOLL', category: 'trend' },
  { id: 'KDJ', label: 'KDJ', category: 'momentum' },
  { id: 'STOCH', label: 'STOCH', category: 'momentum' },
  { id: 'VOL', label: 'VOL', category: 'volume' },
  { id: 'OBV', label: 'OBV', category: 'volume' },
  { id: 'ATR', label: 'ATR', category: 'volatility' },
]

const COLORS = {
  line1: '#c084fc',
  line2: '#34d399',
  line3: '#f87171',
  histogram: 'rgba(192, 132, 252, 0.4)',
}

export default function IndicatorPanel({ symbol, chartRef, visibleFrom, visibleTo }) {
  const [active, setActive] = useState('MACD')
  const containerRef = useRef(null)
  const chartInstanceRef = useRef(null)
  const [latestValue, setLatestValue] = useState(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Get candle data from KLineChart
    const candles = chartRef?.current?.getData?.() || []
    if (candles.length === 0) return

    // Create chart
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: 'solid', color: 'transparent' },
        textColor: '#9ca3af',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#2e303a' },
        horzLines: { color: '#2e303a' },
      },
      rightPriceScale: {
        borderColor: '#2e303a',
      },
      timeScale: {
        borderColor: '#2e303a',
        timeVisible: true,
      },
      height: containerRef.current.clientHeight,
      width: containerRef.current.clientWidth,
    })

    chartInstanceRef.current = chart

    // Render indicator based on active selection
    renderIndicator(chart, candles, active)

    // Resize handling
    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        })
      }
    }
    const observer = new ResizeObserver(handleResize)
    observer.observe(containerRef.current)

    chart.timeScale().fitContent()

    return () => {
      observer.disconnect()
      chart.remove()
      chartInstanceRef.current = null
    }
  }, [active, chartRef, symbol])

  // Sync indicator chart visible range with main chart
  useEffect(() => {
    const chart = chartInstanceRef.current
    if (!chart) return
    const candles = chartRef?.current?.getData?.() || []
    if (candles.length === 0) return

    const dataFrom = candles[0].time
    const dataTo = candles[candles.length - 1].time
    const totalSpan = dataTo - dataFrom
    if (totalSpan <= 0) return

    const from = dataFrom + totalSpan * visibleFrom
    const to = dataFrom + totalSpan * visibleTo

    try {
      chart.timeScale().setVisibleRange({ from, to })
    } catch {
      // Ignore if range is invalid
    }
  }, [visibleFrom, visibleTo, chartRef])

  function renderIndicator(chart, candles, type) {
    let latest = null

    switch (type) {
      case 'MA': {
        const ma20 = calcMA(candles, 20)
        const ma7 = calcMA(candles, 7)
        const s1 = chart.addSeries(LineSeries, { color: COLORS.line1, lineWidth: 2, title: 'MA20' })
        const s2 = chart.addSeries(LineSeries, { color: COLORS.line2, lineWidth: 1, title: 'MA7' })
        s1.setData(ma20)
        s2.setData(ma7)
        if (ma20.length) latest = `MA20: ${ma20.at(-1).value.toFixed(0)} | MA7: ${ma7.at(-1)?.value.toFixed(0) || '—'}`
        break
      }
      case 'EMA': {
        const ema12 = calcEMA(candles, 12)
        const ema26 = calcEMA(candles, 26)
        const s1 = chart.addSeries(LineSeries, { color: COLORS.line1, lineWidth: 2, title: 'EMA12' })
        const s2 = chart.addSeries(LineSeries, { color: COLORS.line2, lineWidth: 1, title: 'EMA26' })
        s1.setData(ema12)
        s2.setData(ema26)
        if (ema12.length) latest = `EMA12: ${ema12.at(-1).value.toFixed(0)} | EMA26: ${ema26.at(-1)?.value.toFixed(0) || '—'}`
        break
      }
      case 'MACD': {
        const { macd, signal, histogram } = calcMACD(candles)
        const s1 = chart.addSeries(LineSeries, { color: COLORS.line1, lineWidth: 2, title: 'MACD' })
        const s2 = chart.addSeries(LineSeries, { color: COLORS.line2, lineWidth: 1, title: 'Signal' })
        const s3 = chart.addSeries(HistogramSeries, { title: 'Hist' })
        s1.setData(macd)
        s2.setData(signal)
        s3.setData(histogram.map((h) => ({
          ...h,
          color: h.value >= 0 ? 'rgba(52,211,153,0.5)' : 'rgba(248,113,113,0.5)',
        })))
        if (macd.length) latest = `MACD: ${macd.at(-1).value.toFixed(0)} | Signal: ${signal.at(-1)?.value.toFixed(0) || '—'}`
        break
      }
      case 'BOLL': {
        const { upper, middle, lower } = calcBOLL(candles)
        const s1 = chart.addSeries(LineSeries, { color: COLORS.line3, lineWidth: 1, title: 'Upper' })
        const s2 = chart.addSeries(LineSeries, { color: COLORS.line1, lineWidth: 2, title: 'Mid' })
        const s3 = chart.addSeries(LineSeries, { color: COLORS.line2, lineWidth: 1, title: 'Lower' })
        s1.setData(upper)
        s2.setData(middle)
        s3.setData(lower)
        if (middle.length) latest = `Mid: ${middle.at(-1).value.toFixed(0)} | Upper: ${upper.at(-1)?.value.toFixed(0)} | Lower: ${lower.at(-1)?.value.toFixed(0)}`
        break
      }
      case 'RSI': {
        const rsi = calcRSI(candles)
        const s1 = chart.addSeries(LineSeries, { color: COLORS.line1, lineWidth: 2, title: 'RSI(14)' })
        s1.setData(rsi)
        if (rsi.length) latest = `RSI(14): ${rsi.at(-1).value.toFixed(1)}`
        break
      }
      case 'KDJ': {
        const { k, d, j } = calcKDJ(candles)
        const s1 = chart.addSeries(LineSeries, { color: COLORS.line1, lineWidth: 2, title: 'K' })
        const s2 = chart.addSeries(LineSeries, { color: COLORS.line2, lineWidth: 1, title: 'D' })
        const s3 = chart.addSeries(LineSeries, { color: COLORS.line3, lineWidth: 1, title: 'J' })
        s1.setData(k)
        s2.setData(d)
        s3.setData(j)
        if (k.length) latest = `K: ${k.at(-1).value.toFixed(1)} | D: ${d.at(-1)?.value.toFixed(1)} | J: ${j.at(-1)?.value.toFixed(1)}`
        break
      }
      case 'STOCH': {
        const { k, d } = calcSTOCH(candles)
        const s1 = chart.addSeries(LineSeries, { color: COLORS.line1, lineWidth: 2, title: '%K' })
        const s2 = chart.addSeries(LineSeries, { color: COLORS.line2, lineWidth: 1, title: '%D' })
        s1.setData(k)
        s2.setData(d)
        if (k.length) latest = `%K: ${k.at(-1).value.toFixed(1)} | %D: ${d.at(-1)?.value.toFixed(1)}`
        break
      }
      case 'VOL': {
        const vol = calcVOL(candles)
        const s1 = chart.addSeries(HistogramSeries, { title: 'VOL' })
        s1.setData(vol)
        if (vol.length) latest = `VOL: ${(vol.at(-1).value / 1000).toFixed(1)}K`
        break
      }
      case 'OBV': {
        const obv = calcOBV(candles)
        const s1 = chart.addSeries(LineSeries, { color: COLORS.line1, lineWidth: 2, title: 'OBV' })
        s1.setData(obv)
        if (obv.length) latest = `OBV: ${(obv.at(-1).value / 1000000).toFixed(2)}M`
        break
      }
      case 'ATR': {
        const atr = calcATR(candles)
        const s1 = chart.addSeries(LineSeries, { color: COLORS.line1, lineWidth: 2, title: 'ATR(14)' })
        s1.setData(atr)
        if (atr.length) latest = `ATR(14): ${atr.at(-1).value.toFixed(0)}`
        break
      }
      default:
        break
    }

    setLatestValue(latest)
  }

  return (
    <div className="indicator-panel">
      <div className="indicator-header">
        <span className="indicator-title">分析指標</span>
        {latestValue && <span className="indicator-latest">{latestValue}</span>}
        <div className="indicator-tags">
          {INDICATORS.map((ind) => (
            <span
              key={ind.id}
              className={`indicator-tag ${active === ind.id ? 'active' : ''}`}
              onClick={() => setActive(ind.id)}
            >
              {ind.label}
            </span>
          ))}
        </div>
      </div>
      <div className="indicator-chart-container" ref={containerRef} />
    </div>
  )
}
