import { useState } from 'react'
import { useBalance } from './useBalance'
import { getAiStrategyParams } from '../../../services/coinApi'

export default function DCAForm({ symbol, currency }) {
  const [form, setForm] = useState({
    amountPerOrder: '',
    maxInvestment: '',
    frequency: 'daily',
    dayOfWeek: 'mon',
    dayOfMonth: '1',
    hourMinute: '00',
    time: '09:00',
    startDate: '',
    targetProfit: '',
    enableTargetProfit: false,
  })
  const [aiLoading, setAiLoading] = useState(false)
  const { balance, loading: balanceLoading } = useBalance()

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const handleAiFill = async () => {
    setAiLoading(true)
    try {
      const res = await getAiStrategyParams('dca', symbol)
      if (res.params) {
        setForm((f) => ({
          ...f,
          amountPerOrder: String(res.params.amountPerOrder ?? f.amountPerOrder),
          frequency: res.params.frequency ?? f.frequency,
          targetProfit: String(res.params.targetProfit ?? f.targetProfit),
        }))
      }
    } catch (err) {
      console.error('AI fill failed:', err)
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div className="strategy-form">
      <h4 className="sf-title">📅 DCA 定投 — {symbol}</h4>
      <p className="sf-desc">固定時間間隔投入固定資金，平攤買入成本。</p>

      {/* 可用餘額 */}
      <div className="sf-balance">
        可用餘額：<span className="sf-balance-value">
          {balanceLoading ? '讀取中...' : balance !== null ? `${balance.toLocaleString()}` : '--'}
        </span> {currency}
      </div>

      {/* 主要參數 */}
      <div className="sf-group">
        <label className="sf-label">每期投入金額（{currency}）</label>
        <input
          type="text"
          inputMode="decimal"
          className="sf-input"
          placeholder="Amount per order"
          value={form.amountPerOrder}
          onChange={(e) => update('amountPerOrder', e.target.value)}
        />
      </div>

      <div className="sf-group">
        <label className="sf-label">最大總投資額（{currency}，可選）</label>
        <input
          type="text"
          inputMode="decimal"
          className="sf-input"
          placeholder="達標後自動停止"
          value={form.maxInvestment}
          onChange={(e) => update('maxInvestment', e.target.value)}
        />
      </div>

      {/* 定投週期 */}
      <div className="sf-group">
        <label className="sf-label">定投週期</label>
        <select
          className="sf-select"
          value={form.frequency}
          onChange={(e) => update('frequency', e.target.value)}
        >
          <option value="hourly">每小時</option>
          <option value="daily">每天</option>
          <option value="weekly">每週</option>
          <option value="monthly">每月</option>
        </select>
      </div>

      {/* 每小時 → 扣款分鐘 */}
      {form.frequency === 'hourly' && (
        <div className="sf-group">
          <label className="sf-label">扣款分鐘（每小時的第幾分）</label>
          <select
            className="sf-select"
            value={form.hourMinute}
            onChange={(e) => update('hourMinute', e.target.value)}
          >
            <option value="00">整點（:00）</option>
            <option value="15">第 15 分（:15）</option>
            <option value="30">第 30 分（:30）</option>
            <option value="45">第 45 分（:45）</option>
          </select>
        </div>
      )}

      {/* 每天 → 扣款時間 */}
      {form.frequency === 'daily' && (
        <div className="sf-group">
          <label className="sf-label">扣款時間</label>
          <input
            type="time"
            className="sf-input"
            value={form.time}
            onChange={(e) => update('time', e.target.value)}
          />
        </div>
      )}

      {/* 每週 → 星期幾 + 時間 */}
      {form.frequency === 'weekly' && (
        <>
          <div className="sf-group">
            <label className="sf-label">扣款日</label>
            <select
              className="sf-select"
              value={form.dayOfWeek}
              onChange={(e) => update('dayOfWeek', e.target.value)}
            >
              <option value="mon">週一</option>
              <option value="tue">週二</option>
              <option value="wed">週三</option>
              <option value="thu">週四</option>
              <option value="fri">週五</option>
              <option value="sat">週六</option>
              <option value="sun">週日</option>
            </select>
          </div>
          <div className="sf-group">
            <label className="sf-label">扣款時間</label>
            <input
              type="time"
              className="sf-input"
              value={form.time}
              onChange={(e) => update('time', e.target.value)}
            />
          </div>
        </>
      )}

      {/* 每月 → 幾日 + 時間 */}
      {form.frequency === 'monthly' && (
        <>
          <div className="sf-group">
            <label className="sf-label">扣款日期</label>
            <select
              className="sf-select"
              value={form.dayOfMonth}
              onChange={(e) => update('dayOfMonth', e.target.value)}
            >
              {Array.from({ length: 28 }, (_, i) => (
                <option key={i + 1} value={String(i + 1)}>每月 {i + 1} 日</option>
              ))}
              <option value="last">每月最後一天</option>
            </select>
          </div>
          <div className="sf-group">
            <label className="sf-label">扣款時間</label>
            <input
              type="time"
              className="sf-input"
              value={form.time}
              onChange={(e) => update('time', e.target.value)}
            />
          </div>
        </>
      )}

      <div className="sf-group">
        <label className="sf-label">首次執行時間</label>
        <input
          type="datetime-local"
          className="sf-input"
          value={form.startDate}
          onChange={(e) => update('startDate', e.target.value)}
        />
      </div>

      {/* 進階設定 */}
      <div className="sf-group">
        <label className="sf-checkbox">
          <input
            type="checkbox"
            checked={form.enableTargetProfit}
            onChange={(e) => update('enableTargetProfit', e.target.checked)}
          />
          啟用目標獲利止盈
        </label>
        {form.enableTargetProfit && (
          <input
            type="number"
            className="sf-input sf-input-inline"
            placeholder="目標獲利 %"
            value={form.targetProfit}
            onChange={(e) => update('targetProfit', e.target.value)}
          />
        )}
      </div>

      {/* 預覽區 */}
      <div className="sf-preview">
        <div className="sf-preview-title">策略預覽</div>
        <div className="sf-preview-row">
          <span>投入頻率</span>
          <span>
            {form.frequency === 'hourly' && `每小時 :${form.hourMinute}`}
            {form.frequency === 'daily' && `每天 ${form.time}`}
            {form.frequency === 'weekly' && `每週${
              { mon: '一', tue: '二', wed: '三', thu: '四', fri: '五', sat: '六', sun: '日' }[form.dayOfWeek]
            } ${form.time}`}
            {form.frequency === 'monthly' && `每月 ${form.dayOfMonth === 'last' ? '最後一天' : `${form.dayOfMonth} 日`} ${form.time}`}
          </span>
        </div>
        <div className="sf-preview-row">
          <span>每期金額</span>
          <span>{form.amountPerOrder || '--'} {currency}</span>
        </div>
        {form.enableTargetProfit && form.targetProfit && (
          <div className="sf-preview-row">
            <span>止盈目標</span>
            <span>{form.targetProfit}%</span>
          </div>
        )}
      </div>

      {/* 操作按鈕 */}
      <div className="sf-actions">
        <button
          type="button"
          className="sf-btn sf-btn-secondary"
          onClick={handleAiFill}
          disabled={aiLoading}
        >
          {aiLoading ? '⏳ AI 分析中...' : '🤖 AI 填入'}
        </button>
        <button type="button" className="sf-btn sf-btn-primary">
          開啟定投計劃
        </button>
      </div>
    </div>
  )
}
