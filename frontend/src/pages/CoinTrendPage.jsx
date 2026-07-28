import { useState } from 'react'
import { useParams } from 'react-router-dom'
import KLineChart from '../components/trend/KLineChart'
import ChartControls from '../components/trend/ChartControls'
import AIChatPanel from '../components/trend/AIChatPanel'
import IndicatorPanel from '../components/trend/IndicatorPanel'
import TradePanel from '../components/trend/TradePanel'
import './CoinTrendPage.css'

export default function CoinTrendPage() {
  const { symbol } = useParams()
  const [interval, setInterval] = useState('1d')
  const [danmakuEnabled, setDanmakuEnabled] = useState(true)

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
            <KLineChart symbol={symbol} interval={interval} />
          </div>
          <ChartControls
            interval={interval}
            onIntervalChange={setInterval}
            danmakuEnabled={danmakuEnabled}
            onDanmakuToggle={() => setDanmakuEnabled(!danmakuEnabled)}
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
