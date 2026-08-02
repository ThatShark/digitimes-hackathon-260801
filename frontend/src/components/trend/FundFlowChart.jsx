import { useState, useEffect } from 'react'
import { getFundFlow } from '../../services/coinApi'
import { isBackendConfigured } from '../../services/api'
import './FundFlowChart.css'

// 顯示用標籤 -> 後端 API 的 period 參數
const PERIODS = [
  { label: '5分', value: '5m' },
  { label: '1小時', value: '1h' },
  { label: '4小時', value: '4h' },
  { label: '1日', value: '1d' },
]

// 後端回傳的 bucket 名稱 -> 中文顯示標籤
const BUCKET_LABELS = [
  { key: 'extra_large', label: '特大單' },
  { key: 'large', label: '大單' },
  { key: 'medium', label: '中單' },
  { key: 'small', label: '小單' },
]

// 後端未設定或請求失敗時的 fallback 內容（單位：萬 TWD），確保畫面不會空白
const MOCK_FLOW = {
  extra_large: { buy: 1280, sell: 960 },
  large: { buy: 3200, sell: 2800 },
  medium: { buy: 5600, sell: 5100 },
  small: { buy: 4200, sell: 4800 },
}
const MOCK_NET_FLOW = [
  { day: '7/25', value: 120 },
  { day: '7/26', value: -80 },
  { day: '7/27', value: 200 },
  { day: '7/28', value: -40 },
  { day: '7/29', value: 310 },
  { day: '7/30', value: 150 },
  { day: '7/31', value: -60 },
]

// 後端回傳的金額單位是 TWD，畫面統一顯示成「萬」，跟 mock 資料的單位一致。
// 四捨五入到小數點後 2 位，避免後續加減運算時把 JS 浮點數誤差
// （例如 336.4 - 0 算出 336.40000000000003）顯示到畫面上。
function twdToWan(value) {
  return Math.round((value / 10000) * 100) / 100
}

function formatDay(unixSeconds) {
  const d = new Date(unixSeconds * 1000)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

// 四捨五入到小數點後 2 位，並清除 JS 浮點數運算殘留的誤差
// （例如 336.4 - 0 可能得到 336.40000000000003）
function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export default function FundFlowChart({ symbol }) {
  const [period, setPeriod] = useState('1日')
  // null = 讀取中；物件 = 已載入（真實資料或 fallback mock）
  const [flow, setFlow] = useState(null)
  const [netFlowSeries, setNetFlowSeries] = useState(null)

  useEffect(() => {
    let cancelled = false
    setFlow(null)
    setNetFlowSeries(null)

    const periodValue = PERIODS.find((p) => p.label === period)?.value || '1h'

    if (!isBackendConfigured()) {
      setFlow(MOCK_FLOW)
      setNetFlowSeries(MOCK_NET_FLOW)
      return
    }

    getFundFlow(symbol, periodValue)
      .then((data) => {
        if (cancelled) return
        const buckets = {}
        for (const { key } of BUCKET_LABELS) {
          const b = data.buckets?.[key] || { buy: 0, sell: 0 }
          buckets[key] = { buy: twdToWan(b.buy), sell: twdToWan(b.sell) }
        }
        setFlow(buckets)

        const series = (data.daily_net_flow || []).map((d) => ({
          day: formatDay(d.time),
          value: twdToWan(d.net_flow),
        }))
        setNetFlowSeries(series.length > 0 ? series : MOCK_NET_FLOW)
      })
      .catch(() => {
        if (cancelled) return
        setFlow(MOCK_FLOW)
        setNetFlowSeries(MOCK_NET_FLOW)
      })

    return () => {
      cancelled = true
    }
  }, [symbol, period])

  const isLoading = flow === null || netFlowSeries === null

  const totalInflow = isLoading ? 0 : Object.values(flow).reduce((s, v) => s + v.buy, 0)
  const totalOutflow = isLoading ? 0 : Object.values(flow).reduce((s, v) => s + v.sell, 0)
  // 四捨五入到小數點後 2 位，避免加總/減法產生的浮點數誤差顯示到畫面上
  const netFlow = round2(totalInflow - totalOutflow)
  const inflowPct = isLoading || totalInflow + totalOutflow === 0
    ? 50
    : Math.round((totalInflow / (totalInflow + totalOutflow)) * 100)

  const maxBar = isLoading
    ? 1
    : Math.max(1, ...netFlowSeries.map((d) => Math.abs(d.value)))

  return (
    <div className="fund-flow-chart">
      {/* Period selector */}
      <div className="flow-header">
        <h3 className="flow-title">資金流向分析</h3>
        <div className="flow-periods">
          {PERIODS.map(({ label }) => (
            <button
              key={label}
              className={`flow-period ${period === label ? 'active' : ''}`}
              onClick={() => setPeriod(label)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flow-loading">讀取中...</div>
      ) : (
        <>
          {/* Pie-style summary */}
          <div className="flow-summary">
            <div className="flow-pie-area">
              <div
                className="flow-pie"
                style={{
                  background: `conic-gradient(#10b981 0deg ${inflowPct * 3.6}deg, #ef4444 ${inflowPct * 3.6}deg 360deg)`,
                }}
              />
              <div className="flow-pie-center">
                <span className={`flow-net ${netFlow >= 0 ? 'up' : 'down'}`}>
                  {netFlow >= 0 ? '+' : ''}{netFlow}
                </span>
                <span className="flow-net-label">淨流入(萬)</span>
              </div>
            </div>

            <div className="flow-breakdown">
              {BUCKET_LABELS.map(({ key, label }) => (
                <FlowRow key={key} label={label} data={flow[key]} />
              ))}
            </div>
          </div>

          {/* Net flow bar chart */}
          <div className="net-flow-section">
            <h4 className="net-flow-title">近 7 日淨資金流向</h4>
            <div className="net-flow-bars">
              {netFlowSeries.map((d, i) => (
                <div key={`${d.day}-${i}`} className="net-bar-col">
                  <div className="net-bar-wrapper">
                    {d.value >= 0 ? (
                      <div
                        className="net-bar up"
                        style={{ height: `${(d.value / maxBar) * 100}%` }}
                      />
                    ) : (
                      <div
                        className="net-bar down"
                        style={{ height: `${(Math.abs(d.value) / maxBar) * 100}%` }}
                      />
                    )}
                  </div>
                  <span className="net-bar-label">{d.day}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function FlowRow({ label, data }) {
  const net = round2(data.buy - data.sell)
  return (
    <div className="flow-row">
      <span className="flow-row-label">{label}</span>
      <span className="flow-in">+{data.buy}</span>
      <span className="flow-out">-{data.sell}</span>
      <span className={`flow-net-val ${net >= 0 ? 'up' : 'down'}`}>
        {net >= 0 ? '+' : ''}{net}
      </span>
    </div>
  )
}
