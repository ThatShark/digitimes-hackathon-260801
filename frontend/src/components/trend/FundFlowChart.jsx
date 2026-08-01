import { useState } from 'react'
import './FundFlowChart.css'

const PERIODS = ['5分', '1小時', '4小時', '1日']

const MOCK_FLOW = {
  superLarge: { inflow: 1280, outflow: 960 },
  large: { inflow: 3200, outflow: 2800 },
  medium: { inflow: 5600, outflow: 5100 },
  small: { inflow: 4200, outflow: 4800 },
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

export default function FundFlowChart({ symbol }) {
  const [period, setPeriod] = useState('1日')

  const totalInflow = Object.values(MOCK_FLOW)
    .reduce((s, v) => s + v.inflow, 0)
  const totalOutflow = Object.values(MOCK_FLOW)
    .reduce((s, v) => s + v.outflow, 0)
  const netFlow = totalInflow - totalOutflow
  const inflowPct = Math.round(
    (totalInflow / (totalInflow + totalOutflow)) * 100
  )

  const maxBar = Math.max(
    ...MOCK_NET_FLOW.map((d) => Math.abs(d.value))
  )

  return (
    <div className="fund-flow-chart">
      {/* Period selector */}
      <div className="flow-header">
        <h3 className="flow-title">資金流向分析</h3>
        <div className="flow-periods">
          {PERIODS.map((p) => (
            <button
              key={p}
              className={`flow-period ${period === p ? 'active' : ''}`}
              onClick={() => setPeriod(p)}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

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
          <FlowRow label="特大單" data={MOCK_FLOW.superLarge} />
          <FlowRow label="大單" data={MOCK_FLOW.large} />
          <FlowRow label="中單" data={MOCK_FLOW.medium} />
          <FlowRow label="小單" data={MOCK_FLOW.small} />
        </div>
      </div>

      {/* Net flow bar chart */}
      <div className="net-flow-section">
        <h4 className="net-flow-title">近 7 日淨資金流向</h4>
        <div className="net-flow-bars">
          {MOCK_NET_FLOW.map((d) => (
            <div key={d.day} className="net-bar-col">
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
    </div>
  )
}

function FlowRow({ label, data }) {
  const net = data.inflow - data.outflow
  return (
    <div className="flow-row">
      <span className="flow-row-label">{label}</span>
      <span className="flow-in">+{data.inflow}</span>
      <span className="flow-out">-{data.outflow}</span>
      <span className={`flow-net-val ${net >= 0 ? 'up' : 'down'}`}>
        {net >= 0 ? '+' : ''}{net}
      </span>
    </div>
  )
}
