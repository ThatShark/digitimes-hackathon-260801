import { useState } from 'react'
import './CopyStrategyModal.css'

const TYPE_LABELS = {
  grid: '現貨網格',
  dca: '定投策略',
  martingale: '馬丁格爾',
  arbitrage: '套利策略',
  basket: '組合包',
  signal: '技術訊號',
}

/**
 * 一鍵複製策略彈窗
 */
export default function CopyStrategyModal({ strategy, onClose, onConfirm }) {
  const [amount, setAmount] = useState('')
  const [stopLoss, setStopLoss] = useState(false)

  const canConfirm = amount && Number(amount) >= 100

  return (
    <div className="strategy-modal-overlay" onClick={onClose}>
      <div className="strategy-modal" onClick={(e) => e.stopPropagation()}>
        <div className="strategy-modal-header">
          <h3>複製{TYPE_LABELS[strategy.type]}</h3>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="strategy-modal-body">
          {/* 系統自動填入的參數 */}
          <div className="prefilled-params">
            <span className="prefilled-title">策略參數（系統自動設定）</span>
            {renderPrefilledParams(strategy)}
          </div>

          {/* 用戶輸入 */}
          <div className="modal-input-group">
            <label className="modal-input-label">
              {getAmountLabel(strategy.type)}
            </label>
            <span className="modal-input-hint">
              {getAmountHint(strategy.type)}
            </span>
            <input
              type="number"
              className="modal-input"
              placeholder="輸入金額 (TWD)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="100"
            />
          </div>

          {/* 進階選項 */}
          <div className="modal-advanced">
            <span className="modal-advanced-title">進階選項</span>
            <label className="modal-checkbox">
              <input
                type="checkbox"
                checked={stopLoss}
                onChange={(e) => setStopLoss(e.target.checked)}
              />
              設定自動停損（跌破策略下限價時停止）
            </label>
          </div>
        </div>

        <div className="strategy-modal-footer">
          <button className="modal-cancel-btn" onClick={onClose}>
            取消
          </button>
          <button
            className="modal-confirm-btn"
            disabled={!canConfirm}
            onClick={onConfirm}
          >
            確認啟動策略
          </button>
        </div>
      </div>
    </div>
  )
}


function renderPrefilledParams(strategy) {
  const { type, params, coin } = strategy
  switch (type) {
    case 'grid':
      return (
        <>
          <div className="prefilled-row">
            <span className="prefilled-label">交易對</span>
            <span className="prefilled-value">{coin}/TWD</span>
          </div>
          <div className="prefilled-row">
            <span className="prefilled-label">價格區間</span>
            <span className="prefilled-value">{params.low} - {params.high}</span>
          </div>
          <div className="prefilled-row">
            <span className="prefilled-label">網格數量</span>
            <span className="prefilled-value">{params.grids} 格</span>
          </div>
        </>
      )
    case 'dca':
      return (
        <>
          <div className="prefilled-row">
            <span className="prefilled-label">標的</span>
            <span className="prefilled-value">{coin}</span>
          </div>
          <div className="prefilled-row">
            <span className="prefilled-label">定投頻率</span>
            <span className="prefilled-value">{params.frequency}</span>
          </div>
        </>
      )
    case 'martingale':
      return (
        <>
          <div className="prefilled-row">
            <span className="prefilled-label">標的</span>
            <span className="prefilled-value">{coin}</span>
          </div>
          <div className="prefilled-row">
            <span className="prefilled-label">跌幅加碼</span>
            <span className="prefilled-value">每跌 {params.dropPct}%</span>
          </div>
          <div className="prefilled-row">
            <span className="prefilled-label">加碼倍數</span>
            <span className="prefilled-value">{params.multiplier}x</span>
          </div>
          <div className="prefilled-row">
            <span className="prefilled-label">止盈目標</span>
            <span className="prefilled-value">+{params.takeProfitPct}%</span>
          </div>
        </>
      )
    case 'arbitrage':
      return (
        <>
          <div className="prefilled-row">
            <span className="prefilled-label">對沖標的</span>
            <span className="prefilled-value">{coin} 現貨+空單</span>
          </div>
          <div className="prefilled-row">
            <span className="prefilled-label">預估年化</span>
            <span className="prefilled-value">{params.estApy}%</span>
          </div>
        </>
      )
    case 'basket':
      return (
        <>
          <div className="prefilled-row">
            <span className="prefilled-label">組合配置</span>
            <span className="prefilled-value">{params.assets.join(' / ')}</span>
          </div>
          <div className="prefilled-row">
            <span className="prefilled-label">再平衡條件</span>
            <span className="prefilled-value">偏離 {params.rebalanceThreshold}%</span>
          </div>
        </>
      )
    case 'signal':
      return (
        <>
          <div className="prefilled-row">
            <span className="prefilled-label">標的</span>
            <span className="prefilled-value">{coin}</span>
          </div>
          <div className="prefilled-row">
            <span className="prefilled-label">觸發條件</span>
            <span className="prefilled-value">{params.condition}</span>
          </div>
        </>
      )
    default:
      return null
  }
}

function getAmountLabel(type) {
  switch (type) {
    case 'grid': return '投入金額 (TWD)'
    case 'dca': return '每次扣款金額 (TWD)'
    case 'martingale': return '首單金額 (TWD)'
    case 'arbitrage': return '對沖總額 (TWD)'
    case 'basket': return '總投資額 (TWD)'
    case 'signal': return '每次下單金額 (TWD)'
    default: return '投入金額 (TWD)'
  }
}

function getAmountHint(type) {
  switch (type) {
    case 'grid': return '系統將自動分配至各網格'
    case 'dca': return '每次定投自動從帳戶扣款'
    case 'martingale': return '首單金額，後續系統依倍數自動加碼'
    case 'arbitrage': return '系統自動分配至現貨買入和空單開倉'
    case 'basket': return '系統依比例自動買入各幣種'
    case 'signal': return '指標觸發時自動下單此金額'
    default: return ''
  }
}
