import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PersonalityBadge from '../shared/PersonalityBadge'
import './StrategyCard.css'

/**
 * 策略卡片 — 支援 6 種策略類型
 *
 * @param {object} props.strategy
 * - type: 'grid' | 'dca' | 'martingale' | 'arbitrage' | 'basket' | 'signal'
 * - author: { name, personality }
 * - coin: string
 * - params: object (依 type 不同有不同欄位)
 * - stats: { apy, runDays, trades, winRate, followers }
 * - risk: 'low' | 'medium' | 'high'
 * - time: string
 * - verified: boolean
 */

const TYPE_LABELS = {
  grid: '現貨網格',
  dca: '定投策略',
  martingale: '馬丁格爾',
  arbitrage: '套利策略',
  basket: '組合包',
  signal: '技術訊號',
}

const TYPE_ICONS = {
  grid: '📊',
  dca: '📅',
  martingale: '🎯',
  arbitrage: '🔄',
  basket: '🧺',
  signal: '📡',
}

export default function StrategyCard({ strategy }) {
  const [copied, setCopied] = useState(false)
  const navigate = useNavigate()

  const handleCopy = () => {
    setCopied(true)
    // 存策略參數到 sessionStorage，跳轉後自動填入
    sessionStorage.setItem('strategy_prefill', JSON.stringify({
      type: strategy.type,
      coin: strategy.coin,
      params: strategy.params,
      author: strategy.author.name,
    }))
    navigate(`/coin/${strategy.coin}`)
    window.scrollTo(0, 0)
    setTimeout(() => setCopied(false), 3000)
  }

  const handleAskAI = () => {
    const prompt = `我在社群看到 ${strategy.author.name} 的${TYPE_LABELS[strategy.type]}策略（${strategy.coin}），${strategy.content ? `他說：「${strategy.content.slice(0, 80)}」，` : ''}請幫我分析這個策略是否適合我，你有什麼建議？`
    const attachment = JSON.stringify({
      type: 'post_card',
      author: strategy.author.name,
      content: strategy.content || `${TYPE_LABELS[strategy.type]} ${strategy.coin}`,
      action: null,
      coin: strategy.coin,
    })
    sessionStorage.setItem('ai_chat_prefill', '請幫我分析這個策略，你有什麼建議？')
    sessionStorage.setItem('ai_chat_prompt', prompt)
    sessionStorage.setItem('ai_chat_attachment', attachment)
    sessionStorage.setItem('ai_chat_auto_send', 'true')
    navigate(`/coin/${strategy.coin}`)
    window.scrollTo(0, 0)
  }

  return (
    <>
      <div className="strategy-card">
        <div className="strategy-card-top">
          {/* Header: type badge + verified */}
          <div className="strategy-header">
            <span className={`strategy-type-badge ${strategy.type}`}>
              {TYPE_ICONS[strategy.type]} {TYPE_LABELS[strategy.type] || strategy.type}
            </span>
            {strategy.verified && (
              <span className="strategy-verified">✓ 實盤驗證</span>
            )}
            {strategy.risk && (
              <span className={`risk-badge ${strategy.risk}`}>
                {strategy.risk === 'low' ? '低風險' : strategy.risk === 'medium' ? '中風險' : '高風險'}
              </span>
            )}
          </div>

          {/* Author */}
          <div className="strategy-author-row">
            <div className="strategy-avatar">{strategy.author.name.charAt(0)}</div>
            <PersonalityBadge personality={strategy.author.personality} compact />
            <span className="strategy-author-name">{strategy.author.name}</span>
            <span className="strategy-time">{strategy.time}</span>
          </div>

          {/* 作者的話 */}
          {strategy.content && (
            <p className="strategy-content-text">{strategy.content}</p>
          )}

          {/* Strategy params */}
          <div className="strategy-params">
            {renderParams(strategy)}
          </div>

          {/* Stats */}
          <div className="strategy-stats">
            {strategy.stats.apy && (
              <span className="strategy-stat">
                年化 <span className="stat-highlight">{strategy.stats.apy}%</span>
              </span>
            )}
            {strategy.stats.runDays && (
              <span className="strategy-stat">
                已運行 <span className="stat-highlight">{strategy.stats.runDays} 天</span>
              </span>
            )}
            {strategy.stats.trades && (
              <span className="strategy-stat">
                套利 <span className="stat-highlight">{strategy.stats.trades} 次</span>
              </span>
            )}
            {strategy.stats.winRate && (
              <span className="strategy-stat">
                勝率 <span className="stat-highlight">{strategy.stats.winRate}%</span>
              </span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="strategy-footer">
          <button
            className="strategy-copy-btn"
            onClick={handleCopy}
            disabled={copied}
          >
            {copied ? '✓ 已複製策略' : `一鍵複製${TYPE_LABELS[strategy.type]}`}
          </button>
          <button
            className="strategy-ai-btn"
            onClick={handleAskAI}
          >
            🤖 詢問AI建議
          </button>
          {strategy.stats.followers && (
            <span className="strategy-followers">{strategy.stats.followers} 人跟隨</span>
          )}
        </div>
      </div>
    </>
  )
}

function renderParams(strategy) {
  const { type, params, coin } = strategy
  switch (type) {
    case 'grid':
      return (
        <>
          <div className="strategy-param">
            <div className="param-label">交易對</div>
            <div className="param-value">{coin}/TWD</div>
          </div>
          <div className="strategy-param">
            <div className="param-label">區間範圍</div>
            <div className="param-value">{params.low} - {params.high}</div>
          </div>
          <div className="strategy-param">
            <div className="param-label">網格數</div>
            <div className="param-value">{params.grids} 格</div>
          </div>
          <div className="strategy-param">
            <div className="param-label">收益率</div>
            <div className="param-value positive">+{params.profit}%</div>
          </div>
        </>
      )
    case 'dca':
      return (
        <>
          <div className="strategy-param">
            <div className="param-label">標的</div>
            <div className="param-value">{coin}</div>
          </div>
          <div className="strategy-param">
            <div className="param-label">頻率</div>
            <div className="param-value">{params.frequency}</div>
          </div>
          <div className="strategy-param">
            <div className="param-label">累積收益</div>
            <div className="param-value positive">+{params.totalReturn}%</div>
          </div>
        </>
      )
    case 'martingale':
      return (
        <>
          <div className="strategy-param">
            <div className="param-label">標的</div>
            <div className="param-value">{coin}</div>
          </div>
          <div className="strategy-param">
            <div className="param-label">跌幅加碼</div>
            <div className="param-value">每跌 {params.dropPct}% 加碼 {params.multiplier}x</div>
          </div>
          <div className="strategy-param">
            <div className="param-label">最大加碼</div>
            <div className="param-value">{params.maxLayers} 次</div>
          </div>
          <div className="strategy-param">
            <div className="param-label">止盈目標</div>
            <div className="param-value positive">反彈 {params.takeProfitPct}%</div>
          </div>
        </>
      )
    case 'arbitrage':
      return (
        <>
          <div className="strategy-param">
            <div className="param-label">對沖標的</div>
            <div className="param-value">{coin} 現貨 + 永續空單</div>
          </div>
          <div className="strategy-param">
            <div className="param-label">預估年化</div>
            <div className="param-value positive">{params.estApy}%</div>
          </div>
          <div className="strategy-param">
            <div className="param-label">資金費率</div>
            <div className="param-value">{params.fundingRate}%/8h</div>
          </div>
        </>
      )
    case 'basket':
      return (
        <>
          <div className="strategy-param">
            <div className="param-label">組合配置</div>
            <div className="param-value">{params.assets.join(' / ')}</div>
          </div>
          <div className="strategy-param">
            <div className="param-label">再平衡條件</div>
            <div className="param-value">偏離 {params.rebalanceThreshold}%</div>
          </div>
          <div className="strategy-param">
            <div className="param-label">組合收益</div>
            <div className="param-value positive">+{params.totalReturn}%</div>
          </div>
        </>
      )
    case 'signal':
      return (
        <>
          <div className="strategy-param">
            <div className="param-label">標的</div>
            <div className="param-value">{coin}</div>
          </div>
          <div className="strategy-param">
            <div className="param-label">觸發條件</div>
            <div className="param-value">{params.condition}</div>
          </div>
          <div className="strategy-param">
            <div className="param-label">歷史勝率</div>
            <div className="param-value positive">{params.winRate}%</div>
          </div>
        </>
      )
    default:
      return null
  }
}
