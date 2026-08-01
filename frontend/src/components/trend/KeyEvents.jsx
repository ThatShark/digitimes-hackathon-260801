import './KeyEvents.css'

const MOCK_EVENTS = [
  { id: 1, type: 'transfer', time: '14:32', amount: '500 BTC', from: '0x7a2...f3c', to: 'Binance Hot Wallet', value: '14.2 億 TWD' },
  { id: 2, type: 'withdraw', time: '13:18', amount: '2,000 ETH', from: 'OKX', to: '0xd9e...a1b', value: '1.97 億 TWD' },
  { id: 3, type: 'deposit', time: '12:45', amount: '100,000 SOL', from: '0x3bc...e7f', to: 'MAX Exchange', value: '5.42 億 TWD' },
  { id: 4, type: 'transfer', time: '11:20', amount: '1,200 BTC', from: 'Coinbase', to: 'Cold Storage', value: '34.2 億 TWD' },
]

const TYPE_MAP = {
  transfer: { icon: '🔄', label: '鏈上轉帳', color: '#60a5fa' },
  withdraw: { icon: '📤', label: '交易所提出', color: '#f59e0b' },
  deposit: { icon: '📥', label: '交易所充入', color: '#10b981' },
}

/**
 * 關鍵事件面板 — 鏈上大額轉帳 log
 */
export default function KeyEvents({ symbol }) {
  return (
    <div className="key-events">
      <div className="events-header">
        <span className="events-title">🔔 關鍵事件</span>
        <span className="events-subtitle">鏈上大額異動</span>
      </div>
      <div className="events-list">
        {MOCK_EVENTS.map((evt) => {
          const meta = TYPE_MAP[evt.type] || TYPE_MAP.transfer
          return (
            <div key={evt.id} className="event-row">
              <span className="event-icon">{meta.icon}</span>
              <div className="event-body">
                <div className="event-top-row">
                  <span className="event-type" style={{ color: meta.color }}>
                    {meta.label}
                  </span>
                  <span className="event-amount">{evt.amount}</span>
                  <span className="event-value">{evt.value}</span>
                </div>
                <div className="event-flow">
                  <span className="event-addr">{evt.from}</span>
                  <span className="event-arrow">→</span>
                  <span className="event-addr">{evt.to}</span>
                </div>
              </div>
              <span className="event-time">{evt.time}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
